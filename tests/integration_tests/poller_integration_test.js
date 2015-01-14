'use strict';
var expect = require('chai').expect;
var sinon = require('sinon');
var BBPromise = require('bluebird');
var poller = require('../../lib/poller');
var Model = require('hoist-model');
var mongoose = BBPromise.promisifyAll(Model._mongoose);
var config = require('config');

describe('with no error in polling ', function () {
  var _response;
  var applicationEvent;
  var jobData;
  var _appUser;
  before(function () {
    return BBPromise.all([
      mongoose.connectAsync(config.get('Hoist.mongo.db')),
      new Model.Organisation({
        _id: 'orgid',
        name: 'test org',
        slug: 'org'
      }).saveAsync(),
      new Model.Application({
        _id: 'testAppId',
        organisation: 'orgid',
        name: 'test app',
        apiKey: 'apiKey',
        slug: 'app',
        settings: {
          test: {
            on: {
              eventName: {
                modules: ['module']
              }
            },
            modules: [{
              name: 'module',
              src: 'test_module.js'
            }]
          }
        }
      }).saveAsync(),
      new Model.ConnectorSetting({
        _id: 'connectorId',
        application: 'testAppId',
        connector: 'connectorId',
        environment: 'test',
        name: 'connector name',
        connectorType: 'test_connector',
        settings: {
          meta: {
            subscriptions: 'subscriptions'
          }
        }
      }).saveAsync(),
      new Model.Subscription({
        _id: 'subscriptionId',
        application: 'testAppId',
        connector: 'connectorId',
        endpoints: '/contacts',
        environment: 'test',
      }).saveAsync(),
      new Model.Subscription({
        _id: 'subscriptionId1',
        application: 'testAppId',
        connector: 'connectorId',
        endpoints: '/customers',
        environment: 'test',
      }).saveAsync(),
      new Model.Bucket({
        _id: 'bucketId',
        application: 'testAppId',
        meta: {
          authToken: 'token'
        },
        environment: 'test'
      }).saveAsync()
    ]).then(function () {
      return poller.start().then(function (response) {
        _response = response;
      });
    });
  });
  after(function () {
    return BBPromise.all([
      Model.Organisation.removeAsync({}),
      Model.Application.removeAsync({}),
      Model.Bucket.removeAsync({}),
      Model.Subscription.removeAsync({}),
      Model.ConnectorSetting.removeAsync({})
    ]).then(function () {
      return mongoose.disconnectAsync();
    });
  });
  it('returns the data from poll.js', function () {
    expect(_response[0].isFulfilled()).to.eql(true);
  });
});