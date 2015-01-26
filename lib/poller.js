'use strict';
var _ = require('lodash');
var BBPromise = require('bluebird');
var Model = require('hoist-model');
var logger = require('hoist-logger');
var config = require('config');
var fs = require('fs');
var path = require('path');

function Poller() {}

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
        // wait ten minutes until next poll
        // _timer = setTimeout(this.start, 600000);
        return promises;
      }).catch(function (err) {
        // clearTimeout(_timer);
        console.log('error:', err);
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
        if (connector.settings.meta.subscriptions) {
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
                      return BBPromise.settle(_.map(buckets, function (bucket) {
                        return self.pollModule(app, bucket, subscription, connector, bouncer);
                      }));
                    });
                });
            });
        }
      });
  },
  pollModule: function (app, bucket, subscription, connector, bouncer) {
    var connectorsPath = path.resolve(config.get('Hoist.connectors.path'));
    var connectorPath = path.join(connectorsPath, connector.connectorType, config.get('Hoist.connectors.currentDirectoryName'));
    connectorPath = fs.realpathSync(connectorPath);
    logger.info('connectorPath', connectorPath);
    var _subscription = this.wrapSubscription(subscription)
    return require(connectorPath)(app.toObject(), bucket.toObject(), _subscription, bouncer.toObject(), connector.toObject())
      .catch(function (err) {
        logger.info('error', err);
        logger.alert(err);
      });
  },
  wrapSubscription: function (subscription) {
    var functions = {
      saveAsync: function () {
        return this.saveAsync()
      },
      markModified: function (fieldName) {
        this.markModified(fieldName)
      }
    };
    return _.merge(subscription.toObject(), functions);
  }
};

module.exports = new Poller();