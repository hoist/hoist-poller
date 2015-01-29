'use strict';
var _ = require('lodash');
var BBPromise = require('bluebird');
var Model = require('hoist-model');
var logger = require('hoist-logger');
var config = require('config');
var fs = require('fs');
var path = require('path');
var SubscriptionController = require('./subscription_controller');
var EventListener = require('./event_listener');

function Poller() {
  this.stopped = false;
}

Poller.prototype = {
  start: function () {
    // var _timer;
    logger.info('starting poller');
    /* istanbul ignore else */
    if (Model._mongoose.connection.readyState !== 1) {
      logger.info('mongo connected');
      Model._mongoose.connect(config.get('Hoist.mongo.db'));
    }
    return Model.Subscription.findAsync({})
      .bind(this)
      .then(function (subscriptions) {
        return BBPromise.settle(_.map(subscriptions, _.bind(this.hydrateSubscription, this)));
      }).then(function (promises) {
        // wait two minutes until next poll
        if (!this.stopped) {
          return BBPromise.delay(120000).bind(this).then(function () {
            return this.start();
          });
        }
        return promises;
      }).catch(function (err) {
        logger.info('error:', err, err.stack);
        console.log('error:', err, err.stack);
      });
  },
  hydrateSubscription: function (subscription) {
    var self = this;
    return Model.ConnectorSetting.findOneAsync({
        key: subscription.connector,
        environment: subscription.environment,
        application: subscription.application
      })
      .then(function (connector) {
        /* istanbul ignore else */
        return Model.Application.findOneAsync({
            _id: connector.application
          })
          .then(function (app) {
            var query = {
              application: app._id,
              environment: subscription.environment,
              connectorKey: connector.key,
              connectorType: connector.connectorType
            };
            return Model.BouncerToken.findOneAsync(query)
              .then(function (bouncer) {
                var query = {
                  application: app._id,
                  environment: subscription.environment
                };
                query['meta.authToken.' + connector.key] = {
                  $exists: true
                };
                return Model.Bucket.findAsync(query)
                  .then(function (buckets) {
                    var info = {
                      connector: connector._id,
                      application: app._id,
                      bouncer: bouncer ? bouncer._id : null
                    };
                    logger.info('inside poller#hydrateSubscription', info);
                    return BBPromise.settle(_.map(buckets, function (bucket) {
                      return self.pollModule(app, bucket, subscription, connector, bouncer);
                    }));
                  });
              });
          });
      }).catch(function (err) {
        logger.info('error', err, err.stack);
        console.log('err', err);
      });
  },
  pollModule: function (app, bucket, subscription, connector, bouncer) {
    // add listeners 
    var _subscription = new SubscriptionController(subscription);
    new EventListener(_subscription, connector, bucket).listen();
    _subscription.eventEmitter.on('done', function () {
      console.log('poll listener done');
      _subscription.eventEmitter.removeAllListeners();
    });
    var connectorsPath = path.resolve(config.get('Hoist.connectors.path'));
    var connectorPath = path.join(connectorsPath, connector.connectorType, config.get('Hoist.connectors.currentDirectoryName'), 'lib/poll.js');
    connectorPath = fs.realpathSync(connectorPath);
    logger.info('connectorPath', connectorPath);
    return require(connectorPath)(app.toObject(), bucket.toObject(), _subscription, bouncer.toObject(), connector.toObject());
  },
  stop: /* istanbul ignore next */ function () {
    this.stopped = true;
  },
  restart: function () {
    this.stopped = false;
    return this.start();
  }
};

module.exports = new Poller();