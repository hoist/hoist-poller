import {
  Subscription,
  ConnectorSetting,
  BouncerToken,
  Bucket
} from '@hoist/model';
import logger from '@hoist/logger';
import fs from 'fs';
import path from 'path';
import config from 'config';
import {
  Authorization
}
from '@hoist/connector-pipeline';
import {
  SubscriptionWrapper
} from './subscription_wrapper';
import {
  isFunction
} from 'lodash';

export class PollExecutor {
  constructor() {
      this._logger = logger.child({
        cls: 'PollExecutor'
      });
    }
    //subscribe to event queue
    //load up subscription for the event
  run() {
    return RabbitPollQueue
      .listen((pollMessage, onComplete) => {
        this.processPoll(pollMessage, onComplete);
      })
  }
  loadContext({
    subscription
  }) {
    return Promise.resolve()
      .then(() => {
        let context = {};
        return ConnectorSetting.findOneAsync({
            key: subscription.connector,
            application: subscription.application._id
          }).then((connectorInstance) => {
            Object.assign(context, {
              subscription,
              connectorInstance,
              application: subscription.application,
              organisation: subscription.application.organisation
            });
          }).then(() => {
            let bucketQuery = {
              application: context.application._id,
              environment: 'live',
            }
            bucketQuery['meta.authToken.' + context.connectorInstance.key] = {
              $exists: true
            };
            //find all buckets and bouncer tokens
            return Promise.all([
              BouncerToken.findAsync({
                application: context.application._id,
                environment: 'live',
                connectorKey: context.connectorInstance.key,
                connectorType: context.connectorInstance.connectorType
              }),
              Bucket.findAsync(bucketQuery)
            ]).then(([bouncerTokens, buckets]) => {
              return buckets.map((bucket) => {
                return Object.assign({}, bucket.toObject(), {
                  bouncerToken: bouncerTokens.find((bt) => {
                    return bt.key === bucket.meta.authToken[context.connectorInstance.key]
                  })
                });
              });
            })
          })
          .then((buckets) => {
            Object.assign(context, {
              buckets
            });
          }).then(() => {
            return context;
          });
      });
  }
  loadSubscription({
    subscriptionId
  }) {
    return Promise.resolve(Subscription.findOne({
        _id: subscriptionId
      })
      .populate('application')
      .populate('application.organisation')
      .exec());
  }
  getPollerMethod({
    context
  }) {
    return Promise.resolve()
      .then(() => {
        var connectorsPath = path.resolve(config.get('Hoist.filePaths.connectors'));
        var pollerPath = path.join(connectorsPath, context.connectorInstance.connectorType, 'current', 'lib/poll.js');
        if (!fs.existsSync(pollerPath)) {
          return null;
        }

        pollerPath = fs.realpathSync(pollerPath);
        if (!fs.existsSync(pollerPath)) {
          return null;
        }
        var pollerMethod = require(pollerPath);

        if (pollerMethod.default && isFunction(pollerMethod.default)) {
          pollerMethod = pollerMethod.default;
        }
        if (!pollerMethod.version) {

          return null;
        }
        return pollerMethod;
      });
  }
  processPoll(pollMessage, onComplete) {
    return this.loadSubscription(pollMessage)
      .then((subscription) => {
        return this.loadContext({
            subscription
          })
          .then((context) => {
            //no buckets to poll so just return
            if (!context.buckets || context.buckets.length < 1) {
              return null;
            }
            return this.getPollerMethod({
                context
              })
              .then((pollerMethod) => {
                if (!pollerMethod) {
                  return null;
                }
                let pollContext = {
                  settings: context.connectorInstance.settings,
                  connectorKey: context.connectorInstance.key,
                  subscription: new SubscriptionWrapper(context.subscription),
                  application: context.application.toObject(),
                  organisation: context.organisation.toObject(),
                  authorizations: context.buckets.map((bucket) => {
                    return {
                      bucket: bucket,
                      bouncerToken: bucket.bouncerToken,
                      authorization: new Authorization(bucket.bouncerToken)
                    }
                  })
                };
                return pollerMethod(pollContext, (eventName, payload) => {
                  return this.raiseEvent({
                    eventName,
                    payload,
                    context: pollContext
                  });
                });
              });
          });
      }).then(() => {
        return onComplete();
      });
  }
  raiseEvent({
    eventName,
    payload,
    context
  }) {
    let eventContext = Object.assign({}, context, {
      environment: 'live'
    });
    return this._eventsPipeline.raise(eventContext, eventName, payload);
  }
}
