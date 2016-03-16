'use strict';
process.env.MUTE_LOGS = true;
require('babel-register');
var PollerService = require('./lib/poller_service.js').default;
var BBPromise = require('bluebird');
var mongoose = BBPromise.promisifyAll(require('@hoist/model')._mongoose);
var config = require('config');
var logger = require('@hoist/logger');
process.title = 'poller' + process.pid;
var pollerService = new PollerService();
var spawn = require('child_process').spawn;

var loggerHub = spawn('bunyansub', ['-o', 'long', '--color', '-l', 'WARN'], {
  stdio: 'inherit'
});

function shutdown() {
  loggerHub.kill();
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
