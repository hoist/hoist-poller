'use strict';
var _ = require('lodash');
var BBPromise = require('bluebird');
var model = require('hoist-model');
var Subscription = model.Subscription;
var Bucket = model.Bucket;
var BouncerToken = model.BouncerToken;
var ConnectorSetting = model.ConnectorSetting;
var SubscriptionWrapper = require('./subscription_wrapper');
var logger = require('hoist-logger');
var fs = require('fs');
var config = require('config');
var path = require('path');
var Authorization = require('hoist-connector-pipeline/lib/authorization');
var HoistContext = require('hoist-context');
var EventPipeline = require('hoist-events-pipeline');

function PollerService() {

}

PollerService.prototype.start = function () {
  //mark as running
  this.running = true;
  //start poll
  this.loop = this.poll().cancellable();
};
PollerService.prototype.stop = function () {
  //mark as stopped
  this.running = false;
  //cancel loop
  /* istanbul ignore else */
  if (this.loop) {
    /* istanbul ignore else */
    if (this.loop.isCancellable()) {
      this.loop.cancel();
    }
    //delete loop
    delete this.loop;
  }


};
PollerService.prototype.poll = function () {
  //load subscriptions
  return this.loadSubscriptions()
    .cancellable()
    .bind(this)
    //for each
    .then(function (subscriptions) {
      return _.map(subscriptions, _.bind(function (subscription) {
        return this.pollSubscription(subscription);
      }, this));
    })
    //poll subscription
    .then(function (pollPromises) {
      return BBPromise.settle(pollPromises).cancellable();
    })
    .then(function () {
      //loop
      /* istanbul ignore else */
      if (this.running) {
        BBPromise.delay(10)
          .cancellable()
          .bind(this)
          .then(function () {
            return this.poll();
          });
      }
    });


};
PollerService.prototype.loadSubscriptions = function () {
  var query = Subscription.find({})
    .populate('application');
  return BBPromise.resolve(query.exec());
};
PollerService.prototype.pollSubscription = function (subscription) {
  return BBPromise.try(function () {
      //wrap subscription
      var context = {
        subscription: new SubscriptionWrapper(subscription),
        application: subscription.application
      };
      return context;
    }, [], this)
    .bind(this)
    .then(function buildContext(context) {
      return ConnectorSetting.findOneAsync({
        key: context.subscription._subscription.connector,
        application: context.application._id,
        environment: 'live'
      }).then(function (connectorSettings) {
        context.connectorSettings = connectorSettings;
        return context;
      });
    })
    .then(function (context) {
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
      return Bucket.findAsync(query)
        .then(function (buckets) {
          context.buckets = buckets;
          return context;
        });
    }).then(function (context) {
      //for each bouncer token
      //poll subscription
      var polls = _.map(context.buckets, _.bind(function (bucket) {
        this.pollContext(context, bucket);
      }, this));
      polls.push(this.pollContext(context));
      return [polls, context];
    }).spread(function (polls, context) {
      //also poll without a bucket for private connections
      return BBPromise.settle(polls).then(function () {
        return context;
      });
    }).then(function (context) {
      //save changes to subscription
      return context.subscription.save();
    });
};

PollerService.prototype.pollContext = function (context, bucket) {
  BBPromise.try(function () {
      /* istanbul ignore else */
      if (bucket) {
        return BouncerToken.findOneAsync({
          _id: bucket.meta.authToken[context.connectorSettings.key]
        });
      }
    }, [], this)
    .bind(this)
    .then(function (bouncerToken) {
      var connectorsPath = path.resolve(config.get('Hoist.connectors.path'));
      var pollerPath = path.join(connectorsPath, context.connectorSettings.connectorType, config.get('Hoist.connectors.currentDirectoryName'), 'lib/poll.js');
      pollerPath = fs.realpathSync(pollerPath);
      logger.info('pollerPath', pollerPath);

      var pollerMethod = require(pollerPath);
      var pollContext = {
        settings: context.connectorSettings.settings,
        authorization: new Authorization(bouncerToken),
        connectorKey: context.connectorSettings.key,
        subscription: context.subscription,
        application: context.application.toObject()
      };
      if (bucket) {
        pollContext.bucket = bucket.toObject();
      }
      return pollerMethod(pollContext, _.bind(function (eventName, payload) {
        return this.raiseEvent(pollContext, eventName, payload);
      }, this));
    });
};
PollerService.prototype.raiseEvent = function (context, eventName, payload) {
  var eventPipeline = new EventPipeline(HoistContext, model);
  HoistContext.get()
    .then(function (hoistContext) {
      hoistContext.application = context.application;
      hoistContext.bucket = context.bucket;
      hoistContext.environment = 'live';
    }).then(function () {
      eventPipeline.raise(eventName, payload);
    });
};

module.exports = PollerService;
