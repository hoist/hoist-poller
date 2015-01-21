'use strict';
var BBPromise = require('bluebird');

module.exports = function (app, bucket, subscription, bouncer) {
  console.log('hello world');
  return BBPromise.resolve({});
}