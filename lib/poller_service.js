'use strict';
import _ from 'lodash';
import {
  Subscription,
  Bucket,
  BouncerToken,
  ConnectorSetting,
  Application
}
from '@hoist/model';
import SubscriptionWrapper from './subscription_wrapper';
import logger from '@hoist/logger';
import Bluebird from 'bluebird';
import fs from 'fs';
import config from 'config';
import path from 'path';
import {
  Authorization
}
from '@hoist/connector-pipeline';
import EventsPipeline from '@hoist/events-pipeline';
import throat from 'throat';
import moment from 'moment';
import {
  isFunction
} from 'lodash';

Bluebird.config({
  cancellation: true
});

class PollerService {
  constructor() {
    this._logger = logger.child({
      cls: this.constructor.name
    });
    this._eventsPipeline = new EventsPipeline();
  }
  start() {
    this._logger.info('starting poller service');
    //mark as running
    this.running = true;
    //start poll
    this._logger.debug('starting loop');
    let _this = this;
    return Subscription.updateAsync({
        active: true
      }, {
        $set: {
          active: false
        }
      }, {
        multi: true
      })
      .then(function () {
        _this.loop = _this.poll();
      });
  }
  stop() {
    return Bluebird.try(() => {
      this._logger.info('stopping poller service');
      //mark as stopped
      this.running = false;
      //cancel loop
      /* istanbul ignore else */
      if (this.loop) {
        if (this.loop.isCancellable()) {
          this._logger.debug('cancelling loop');
          this.loop.cancel();
        } else {
          this._logger.warn('loop isn\'t cancellable for some reason');
        }
        //delete loop
        this._logger.info('deleting loop promise reference');
        delete this.loop;
      }
    }, [], this);

  }
  poll() {
    //load subscriptions
    this._logger.info('loading subscriptions');
    let subscriptionLoaded = false;
    return this.loadSubscriptions()
      .bind(this)
      //for each
      .then((subscriptions) => {
        if (subscriptions && _.filter(subscriptions).length > 0) {
          subscriptionLoaded = true;
        }
        return Promise.all(subscriptions.map((subscription) => {
            if (subscription) {
              return Application.populateAsync(subscription.application, 'organisation');
            }
          })).then(() => {
            this._logger.debug({
              subscriptions: subscriptions.map((subscription) => {
                if (subscription) {
                  return subscription._id;
                }
              })
            }, 'polling each subscription');
            return _.map(subscriptions, throat(1, _.bind((subscription) => {
              return this.pollSubscription(subscription);
            }, this)));
          })
          //poll subscription
          .then((pollPromises) => {
            this._logger.info('settling all polls');
            return Bluebird.settle(pollPromises);
          })
          .then(() => {
            //loop
            /* istanbul ignore else */
            if (this.running) {
              this._logger.info('pausing');
              let delay = 5000;
              if (subscriptionLoaded) {
                delay = 10;
                subscriptionLoaded = false;
              }
              return Bluebird.delay(delay)
                .bind(this)
                .then(() => {
                  this._logger.info('looping');
                  return this.poll();
                });
            } else {
              this._logger.info('poller stopped so stopping');
            }
          }).catch((err) => {
            this._logger.error(err, 'error during poll loop');
            return Promise.all(subscriptions.map((subscription) => {
              subscription.active = false;
              subscription.markModiled('active');
              subscription.save();
            }));
          });
      }).catch((err) => {
        this._logger.error(err, 'error during poll loop');
      });
  }
  loadSubscriptions() {

    this.polledSubscriptions = this.polledSubscriptions || [];
    var query = Subscription.findOneAndUpdate({
        $and: [{
          _id: {
            $nin: _.clone(this.polledSubscriptions)
          }
        }, {
          $or: [{
            active: false
          }, {
            active: {
              $exists: false
            }
          }]
        }, {
          $or: [{
            nextPoll: {
              $lt: moment().utc().toDate()
            }
          }, {
            nextPoll: {
              $exists: false
            }
          }]
        }]
      }, {
        $set: {
          active: true
        }
      })
      .populate('application')
      .populate('applicaiton.organisation');
    return Bluebird.resolve(query.exec()).then((result) => {
      if (!result) {
        this.polledSubscriptions = [];
      } else {
        this.polledSubscriptions.push(result._id);
      }
      return [].concat(result);
    });
  }
  pollSubscription(subscription) {
    this._logger.info({
      subscription: subscription._id,
      application: subscription.application._id
    }, 'polling subscription');
    return Promise.resolve().then(() => {
        //wrap subscription
        var context = {
          subscription: new SubscriptionWrapper(subscription),
          application: subscription.application,
          organisation: subscription.application.organisation
        };
        return context;
      })
      .then((context) => {
        return ConnectorSetting.findOneAsync({
          key: context.subscription._subscription.connector,
          application: context.application._id,
          environment: 'live'
        }).then((connectorSettings) => {
          this._logger.debug({
            connectorSetting: connectorSettings._id
          }, 'loaded connector settings');
          context.connectorSettings = connectorSettings;
          return context;
        });
      })
      .then((context) => {
        this._logger.debug('setting context');
        //load buckets
        //load bouncer tokens based on buckets
        var query = {
          application: context.application._id,
          environment: 'live'
        };
        //load only buckets with authTokens attached
        query['meta.authToken.' + context.connectorSettings.key] = {
          $exists: true
        };
        this._logger.debug({
          subscription: subscription._id,
          application: subscription.application._id
        }, 'finding all auth buckets');
        return Bucket.findAsync(query)
          .then((buckets) => {
            this._logger.debug({
              buckets: _.map(buckets, '_id')
            }, 'found buckets');
            context.buckets = buckets;
            return context;
          });
      }).then((context) => {
        //for each bouncer token
        //poll subscription
        this._logger.debug({
          subscription: subscription._id,
          application: subscription.application._id,
          buckets: _.map(context.buckets, '_id')
        }, 'polling all buckets');
        var polls = _.map(context.buckets, throat(4, _.bind((bucket) => {
          this._logger.debug({
            bucket: bucket._id
          }, 'adding poll for bucket');
          return this.pollContext(context, bucket);
        }, this)));
        polls.push(this.pollContext(context).catch((err) => {
          console.log(err);
          this._logger.error(err);
        }));
        return {
          polls,
          context
        };
      }).then((result) => {
        this._logger.debug({
          subscription: subscription._id,
          application: subscription.application._id
        }, 'settling root poll calls');
        //also poll without a bucket for private connections
        return Promise.all(result.polls).then(() => {
          return result.context;
        });
      }).then((context) => {
        //save changes to subscription
        this._logger.info({
          subscription: subscription._id,
          application: subscription.application._id
        }, 'saving updates to subscription');
        context.subscription._subscription.active = false;
        context.subscription._subscription.markModified('active');
        return context.subscription.save();
      });
  }

  pollContext(context, bucket) {
    this._logger.debug({
      subscription: context.subscription._id,
      application: context.application._id,
      bucket: bucket ? bucket._id : /* istanbul ignore next */ null
    }, 'polling context');
    return Bluebird.resolve()
      .then(() => {
        /* istanbul ignore else */
        if (bucket) {
          this._logger.info({
            bucket: bucket._id,
            authToken: bucket.meta.authToken[context.connectorSettings.key]
          }, 'polling with a bucket');
          return BouncerToken.findOneAsync({
            key: bucket.meta.authToken[context.connectorSettings.key]
          });
        } else {
          this._logger.info('polling without a bucket');
        }
      }, [], this)
      .then((bouncerToken) => {
        var connectorsPath = path.resolve(config.get('Hoist.filePaths.connectors'));
        var pollerPath = path.join(connectorsPath, context.connectorSettings.connectorType, 'current', 'lib/poll.js');
        pollerPath = fs.realpathSync(pollerPath);
        this._logger.debug({
          path: pollerPath
        }, 'loading poller');

        var pollerMethod = require(pollerPath);
        if (pollerMethod.default && isFunction(pollerMethod.default)) {
          pollerMethod = pollerMethod.default;
        }
        var pollContext = {
          settings: context.connectorSettings.settings,
          connectorKey: context.connectorSettings.key,
          subscription: context.subscription,
          application: context.application.toObject(),
          organisation: context.organisation.toObject()
        };
        if (bouncerToken) {
          this._logger.debug('setting auth');
          pollContext.authorization = new Authorization(bouncerToken);
        }
        if (bucket) {
          this._logger.debug('setting bucket');
          pollContext.bucket = bucket.toObject();
        }
        this._logger.info({
          application: pollContext.application._id
        }, 'calling poll');
        return pollerMethod(pollContext, (eventName, payload) => {
          return this.raiseEvent(pollContext, eventName, payload);
        }).then(() => {
          this._logger.info({
            application: pollContext.application._id
          }, 'poll done');
        });
      }).catch((err) => {
        console.log(err);
        this._logger.error(err);
      });
  }
  raiseEvent(context, eventName, payload) {
    context.environment = 'live';
    this._logger.debug({
      context: context,
      eventName: eventName,
      payload: payload
    }, 'raising event');
    this._logger.debug({
      eventName: eventName,
      application: context.application._id
    }, 'raising event');

    return this._eventsPipeline.raise(context, eventName, payload);
  }
}


module.exports = PollerService;
