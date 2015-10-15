'use strict';
process.env.MUTE_LOGS = true;
require('babel/register');
var PollerService = require('./lib/poller_service.js');
var BBPromise = require('bluebird');
var mongoose = BBPromise.promisifyAll(require('@hoist/model')._mongoose);
var config = require('config');
var logger = require('@hoist/logger');
process.title = 'poller' + process.pid;
var pollerService = new PollerService();

function shutdown() {
  logger.info('stopping poller');
  pollerService.stop()
    .then(function () {
      logger.info('shutting down mongo connection');
      return mongoose.disconnectAsync();
    }).then(function () {
      logger.info('exiting process');
      process.exit(0);
    });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

logger.info('connecting to mongo');
mongoose.connectAsync(config.get('Hoist.mongo.core.connectionString'))
  .then(function () {
    logger.info('starting poller');
    return pollerService.start();
  });
