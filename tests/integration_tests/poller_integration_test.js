'use strict';
var expect = require('chai').expect;
var sinon = require('sinon');
var BBPromise = require('bluebird');
var poller = require('../../lib/poller');
var Model = require('hoist-model');
var mongoose = BBPromise.promisifyAll(Model._mongoose);
var poll = require('../fixtures/test_connectors/test_connector/poll');
var _ = require('lodash');

var config = require('config');
describe('poller', function () {
  before(function () {
    return mongoose.connectAsync(config.get('Hoist.mongo.db'))
  })
  after(function () {
    return mongoose.disconnectAsync()
  })
  describe('with no connection error in polling ', function () {
    var _response;
    var _subscription;
    var applicationEvent;
    var jobData;
    var _appUser;
    before(function () {
      return BBPromise.all([
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
          _id: 'connectorKey',
          application: 'testAppId',
          key: 'connectorKey',
          environment: 'test',
          name: 'connector name',
          connectorType: 'test_connector',
          settings: {
            meta: {
              subscriptions: 'subscriptions'
            },
            clientId: '2191990946.3236346965',
            clientSecret: '4891ea22c6647aa0982700af5b2c6ea2'
          }
        }).saveAsync(),
        new Model.BouncerToken({
          _id: "Gq5fW1QMGmilWDADNYTd",
          application: "testAppId",
          connectorKey: "connectorKey",
          connectorType: "test_connector",
          environment: "test",
          key: "N9hNCj56Tqi1GWI6Mkdn3QTgFdKDyGaT",
          state: {
            token: "xoxp-2191990946-2864070152-3238438064-50a1b7",
            code: "2191990946.3424592343.b3690b958b"
          }
        }).saveAsync(),
        new Model.Subscription({
          _id: 'subscriptionId',
          application: 'testAppId',
          connector: 'connectorKey',
          endpoints: ['/channels.list', 'channels.list'],
          environment: 'test',
        }).saveAsync().then(function (sub) {
          _subscription = sub[0];
        }),
        new Model.Bucket({
          _id: 'bucketId',
          application: 'testAppId',
          meta: {
            authToken: {
              connectorKey: 'N9hNCj56Tqi1GWI6Mkdn3QTgFdKDyGaT'
            }
          },
          environment: 'test'
        }).saveAsync(),
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
        Model.BouncerToken.removeAsync({}),
        Model.Subscription.removeAsync({}),
        Model.ConnectorSetting.removeAsync({})
      ])
    });
    it('returns the promise', function () {
      expect(_response[0].isFulfilled()).to.eql(true);
    });
    it('adds set onto the wrapped subscription object', function () {
      expect(_response[0]._settledValue[0]._settledValue['2']).to.have.property('set');
    });
    it('adds get onto the wrapped subscription object', function () {
      expect(_response[0]._settledValue[0]._settledValue['2']).to.have.property('get');
    });
  });
  describe('with a connection error in polling ', function () {
    var _response;
    var applicationEvent;
    var jobData;
    var _appUser;
    before(function () {
      return BBPromise.all([
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
          _id: 'connectorKey',
          application: 'testAppId',
          key: 'connectorKey',
          environment: 'test',
          name: 'connector name',
          connectorType: 'test_connector',
          settings: {
            meta: {
              subscriptions: 'subscriptions'
            },
            clientId: '2191990946.3236346965',
            clientSecret: '4891ea22c6647aa0982700af5b2c6ea2'
          }
        }).saveAsync(),
        new Model.BouncerToken({
          _id: "Gq5fW1QMGmilWDADNYTd",
          application: "testAppId",
          connectorKey: "connectorKey",
          connectorType: "test_connector",
          environment: "test",
          key: "N9hNCj56Tqi1GWI6Mkdn3QTgFdKDyGaT",
          state: {
            token: "xoxp-2191990946-2864070152-3238438064-50a1b7",
            code: "2191990946.3424592343.b3690b958b"
          }
        }).saveAsync(),
        new Model.Subscription({
          _id: 'subscriptionId',
          application: 'testAppId',
          connector: 'connectorKey',
          endpoints: ['/channels.list', 'channels.list'],
          environment: 'test',
        }).saveAsync(),
        new Model.Bucket({
          _id: 'bucketId',
          application: 'testAppId',
          meta: {
            authToken: {
              connectorKey: 'N9hNCj56Tqi1GWI6Mkdn3QTgFdKDyGaT'
            }
          },
          environment: 'test'
        }).saveAsync(),
      ])
    });
    after(function () {
      return BBPromise.all([
        Model.Organisation.removeAsync({}),
        Model.Application.removeAsync({}),
        Model.Bucket.removeAsync({}),
        Model.BouncerToken.removeAsync({}),
        Model.Subscription.removeAsync({}),
        Model.ConnectorSetting.removeAsync({})
      ])
    });
    it('reconnects mongoose', function () {
      return mongoose.disconnectAsync().then(function () {
        return poller.start().then(function () {
          expect(mongoose.connection.readyState).to.eql(1);
        });

      })
    });
    it('returns the promise', function () {
      return mongoose.disconnectAsync().then(function () {
        return poller.start().then(function (response) {
          _response = response;
          expect(_response[0].isFulfilled()).to.eql(true);
        });

      })
    });
    it('adds set onto the wrapped subscription object', function () {
      return mongoose.disconnectAsync().then(function () {
        return poller.start().then(function (response) {
          _response = response;
          expect(_response[0]._settledValue[0]._settledValue['2']).to.have.property('set');
        });
      });
    });
    it('adds get onto the wrapped subscription object', function () {
      return mongoose.disconnectAsync().then(function () {
        return poller.start().then(function (response) {
          _response = response;
          expect(_response[0]._settledValue[0]._settledValue['2']).to.have.property('get');
        });
      });
    });
  });
})