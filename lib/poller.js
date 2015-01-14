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
    logger.info('starting poller');
    if (Model._mongoose.connection.readyState !== 1) {
      logger.info('mongo connected');
      Model._mongoose.connect(config.get('Hoist.mongo.db'));
    }

    return Model.Subscription.findAsync({})
      .bind(this)
      .then(function (subscriptions) {
        return BBPromise.settle(_.map(subscriptions, _.bind(this.hydrateSubscription, this)));
      });
  },
  hydrateSubscription: function (subscription) {
    var self = this;
    var _app;
    return Model.ConnectorSetting.findOneAsync({
        _id: subscription.connector
      })
      .then(function (connector) {
        if (connector.settings.meta.subscriptions) {
          return Model.Application.findOneAsync({
              _id: connector.application
            })
            .then(function (app) {
              _app = app;
              return Model.Bucket.findAsync({
                  'meta.authToken': {
                    $exists: true
                  }
                })
                .then(function (buckets) {
                  return BBPromise.settle(_.map(buckets, function (bucket) {
                    return self.pollModule(_app, bucket, subscription, connector.connectorType);
                  }));
                });
            });
        }
      });
  },
  pollModule: function (app, bucket, subscription, type) {
    var connectorsPath = path.resolve(config.get('Hoist.connectors.path'));
    var connectorPath = path.join(connectorsPath, type, config.get('Hoist.connectors.currentDirectoryName'));
    connectorPath = fs.realpathSync(connectorPath);
    logger.info('connectorPath', connectorPath);
    return require(connectorPath)(app, bucket, subscription);
  }
};

module.exports = new Poller();