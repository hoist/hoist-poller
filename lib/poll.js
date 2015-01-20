';use strict'
var _ = require('lodash');
var Connector = require('./lib/connector');
var Hoist = require('hoist-connect');
var Model = Hoist._model;
var mongoose = Model._mongoose;
var BBPromise = require('bluebird');

module.exports = function (app, bucket, subscription, bouncer) {

  console.log(subscription.endpoints)
  console.log('hello world', arguments);

}