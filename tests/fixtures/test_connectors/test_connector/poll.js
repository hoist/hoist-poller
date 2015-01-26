'use strict';
var BBPromise = require('bluebird');

module.exports = function (app, bucket, subscription, bouncer, connector) {
  console.log('hello world');
  return BBPromise.resolve({});
}