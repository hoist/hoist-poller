'use strict';
var BBPromise = require('bluebird');

module.exports = function (app, bucket, subscription, bouncer, connector) {
  return BBPromise.resolve(arguments)
}