'use strict';
var expect = require('chai').expect;
var BBPromise = require('bluebird');
var poller = require('../../lib/poller');
// stops the loop
poller.stopped = true;
var Model = require('hoist-model');
var mongoose = BBPromise.promisifyAll(Model._mongoose);

var config = require('config');
describe('poller', function () {
  before(function () {
    return mongoose.connectAsync(config.get('Hoist.mongo.db'));
  });
  after(function () {
    return mongoose.disconnectAsync();
  });
  describe('with no connection error in polling ', function () {
    var _response;
    var _subscription;
    before(function (done) {
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
          connectorType: 'hoist-connector-test',
          settings: {
            meta: {
              subscriptions: 'subscriptions'
            },
            authType: 'Private',
            clientId: '2191990946.3236346965',
            clientSecret: '4891ea22c6647aa0982700af5b2c6ea2'
          }
        }).saveAsync(),
        new Model.BouncerToken({
          _id: "Gq5fW1QMGmilWDADNYTd",
          application: "testAppId",
          connectorKey: "connectorKey",
          connectorType: "hoist-connector-test",
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
          endpoints: ['Invoices', 'Contacts'],
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
          done();
        });
      }).catch(function (err) {
        console.log('err', err);
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
      ]);
    });
    it('returns the promise', function () {
      expect(_response[0].isFulfilled()).to.eql(true);
    });
    it('sets up a listener correctly ', function () {
      expect(_response[0]._settledValue).to.eql(true);
    });
  });
  describe('with a connection error in polling ', function () {
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
          connectorType: 'hoist-connector-test',
          settings: {
            meta: {
              subscriptions: 'subscriptions'
            },
            authType: 'Private',
            clientId: '2191990946.3236346965',
            clientSecret: '4891ea22c6647aa0982700af5b2c6ea2'
          }
        }).saveAsync(),
        new Model.BouncerToken({
          _id: "Gq5fW1QMGmilWDADNYTd",
          application: "testAppId",
          connectorKey: "connectorKey",
          connectorType: "hoist-connector-test",
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
          endpoints: ['Invoices', 'Contacts'],
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
      ]);
    });
    after(function () {
      return BBPromise.all([
        Model.Organisation.removeAsync({}),
        Model.Application.removeAsync({}),
        Model.Bucket.removeAsync({}),
        Model.BouncerToken.removeAsync({}),
        Model.Subscription.removeAsync({}),
        Model.ConnectorSetting.removeAsync({})
      ]);
    });
    it('reconnects mongoose', function () {
      return mongoose.disconnectAsync().then(function () {
        return poller.start().then(function () {
          expect(mongoose.connection.readyState).to.eql(1);
        });

      });
    });
    it('returns the promise', function () {
      return mongoose.disconnectAsync().then(function () {
        return poller.start().then(function (response) {
          expect(response[0].isFulfilled()).to.eql(true);
        });

      });
    });
    it('sets up a listener correctly', function () {
      return mongoose.disconnectAsync().then(function () {
        return poller.start().then(function (response) {
          expect(response[0]._settledValue).to.eql(true);
        });
      });
    });
  });
  describe('with invalid connector path ', function () {
    var _response;
    var _subscription;
    before(function (done) {
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
          connectorType: 'hoist-connector-faketest',
          settings: {
            meta: {
              subscriptions: 'subscriptions'
            },
            authType: 'Private',
            clientId: '2191990946.3236346965',
            clientSecret: '4891ea22c6647aa0982700af5b2c6ea2'
          }
        }).saveAsync(),
        new Model.BouncerToken({
          _id: "Gq5fW1QMGmilWDADNYTd",
          application: "testAppId",
          connectorKey: "connectorKey",
          connectorType: "hoist-connector-faketest",
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
          endpoints: ['Invoices', 'Contacts'],
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
          done();
        });
      }).catch(function (err) {
        console.log('error', err, err.stack);
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
      ]);
    });
    it('catches the error', function () {
      expect(_response[0].isFulfilled()).to.eql(true);
    });
  });
});