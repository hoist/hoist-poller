'use strict';
var expect = require('chai').expect;
var BBPromise = require('bluebird');
var SubscriptionController = require('../../lib/subscription_controller');
var Model = require('hoist-model');
var mongoose = BBPromise.promisifyAll(Model._mongoose);
var config = require('config');

describe('SubscriptionController', function () {
  before(function () {
    return mongoose.connectAsync(config.get('Hoist.mongo.db'));
  });
  after(function () {
    return mongoose.disconnectAsync();
  });
  describe('constructor', function () {
    var _subscription;
    var _subscriptionModel;
    before(function () {
      return new Model.Subscription({
        _id: 'subscriptionId',
        application: 'testAppId',
        connector: 'connectorKey',
        endpoints: ['/Contacts', '/Invoices'],
        environment: 'test',
      }).saveAsync().then(function (sub) {
        _subscriptionModel = sub[0];
        _subscription = new SubscriptionController(sub[0]);
      });
    });
    after(function () {
      return Model.Subscription.removeAsync({});
    });

    it('sets the suscription attributes', function () {
      expect(_subscription._id).to.eql(_subscriptionModel._id);
      expect(_subscription.connector).to.eql(_subscriptionModel.connector);
      expect(_subscription.application).to.eql(_subscriptionModel.application);
      expect(_subscription.endpoints).to.have.members(_subscriptionModel.endpoints);
      expect(_subscription.environment).to.eql(_subscriptionModel.environment);
    });
    it('creates a get function on the subscription', function () {
      expect(typeof _subscription.get).to.eql('function');
    });
    it('creates a get function on the subscription', function () {
      expect(typeof _subscription.set).to.eql('function');
    });
  });
  describe('#GET', function () {
    describe('with no meta', function () {
      var _subscription;
      var _subscriptionModel;
      var _result;
      before(function () {
        return new Model.Subscription({
          _id: 'subscriptionId',
          application: 'testAppId',
          connector: 'connectorKey',
          endpoints: ['/Contacts', '/Invoices'],
          environment: 'test',
        }).saveAsync().then(function (sub) {
          _subscriptionModel = sub[0];
          _subscription = new SubscriptionController(sub[0]);
          _result = _subscription.get('fakeKey');

        });
      });
      after(function () {
        return Model.Subscription.removeAsync({});
      });
      it('returns null', function () {
        expect(_result).to.eql(null);
      });
    });
    describe('with meta', function () {
      var _subscription;
      var _subscriptionModel;
      var _result;
      before(function () {
        return new Model.Subscription({
          _id: 'subscriptionId',
          application: 'testAppId',
          connector: 'connectorKey',
          endpoints: ['/Contacts', '/Invoices'],
          environment: 'test',
          meta: {
            fakeKey: 'fakeValue'
          }
        }).saveAsync().then(function (sub) {
          _subscriptionModel = sub[0];
          _subscription = new SubscriptionController(sub[0]);
          _result = _subscription.get('fakeKey');
        });
      });
      after(function () {
        return Model.Subscription.removeAsync({});
      });
      it('returns value', function () {
        expect(_result).to.eql('fakeValue');
      });
    });
    describe('with invalid key', function () {
      var _subscription;
      var _subscriptionModel;
      var _result;
      before(function () {
        return new Model.Subscription({
          _id: 'subscriptionId',
          application: 'testAppId',
          connector: 'connectorKey',
          endpoints: ['/Contacts', '/Invoices'],
          environment: 'test',
          meta: {
            fakeKey: 'fakeValue'
          }
        }).saveAsync().then(function (sub) {
          _subscriptionModel = sub[0];
          _subscription = new SubscriptionController(sub[0]);
          _result = _subscription.get('invalidKey');
        });
      });
      after(function () {
        return Model.Subscription.removeAsync({});
      });
      it('returns undefined', function () {
        expect(_result).to.eql(undefined);
      });
    });
  });
  describe('#SET', function () {
    describe('with no meta', function () {
      var _subscription;
      var _subscriptionModel;
      var _result;
      before(function () {
        return new Model.Subscription({
          _id: 'subscriptionId',
          application: 'testAppId',
          connector: 'connectorKey',
          endpoints: ['/Contacts', '/Invoices'],
          environment: 'test',
        }).saveAsync().then(function (sub) {
          _subscriptionModel = sub[0];
          _subscription = new SubscriptionController(sub[0]);
          return _subscription.set('fakeKey', 'fakeValue').then(function (result) {
            _result = result;
          });
        });
      });
      after(function () {
        return Model.Subscription.removeAsync({});
      });
      it('returns the updated _subscription', function () {
        expect(_result.meta).to.eql({
          fakeKey: 'fakeValue'
        });
      });
    });
    describe('with meta', function () {
      var _subscription;
      var _subscriptionModel;
      before(function () {
        return new Model.Subscription({
          _id: 'subscriptionId',
          application: 'testAppId',
          connector: 'connectorKey',
          endpoints: ['/Contacts', '/Invoices'],
          environment: 'test',
          meta: {
            fakeKey: 'fakeValue'
          }
        }).saveAsync().then(function (sub) {
          _subscriptionModel = sub[0];
          _subscription = new SubscriptionController(sub[0]);

        });
      });
      after(function () {
        return Model.Subscription.removeAsync({});
      });
      describe('and value not an object', function () {
        it('returns subscription', function () {
          return _subscription.set('newKey', 'newValue').then(function (result) {
            expect(result.meta).to.eql({
              fakeKey: 'fakeValue',
              newKey: 'newValue'
            });
          });
        });
      });
      describe('and value an object', function () {
        it('returns updated subscription', function () {
          return _subscription.set('fakeKey', {anotherKey: 'anotherNewValue'}).then(function (result) {
            expect(result.meta).to.eql({
              fakeKey: {anotherKey: 'anotherNewValue'},
              newKey: 'newValue'
            });
          });
        });
      });
      describe('and both meta and value an object', function () {
        it('merges the two objects correctly and returns subscription correctly', function () {
          return _subscription.set('fakeKey', {testKey: 'testValue'}).then(function (result) {
            expect(result.meta).to.eql({
              fakeKey: {anotherKey: 'anotherNewValue', testKey: 'testValue'},
              newKey: 'newValue'
            });
          });
        });
      });
    });
  });
});