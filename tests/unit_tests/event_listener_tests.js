'use strict';
var expect = require('chai').expect;
var BBPromise = require('bluebird');
var EventListener = require('../../lib/event_listener');
var Model = require('hoist-model');
var mongoose = BBPromise.promisifyAll(Model._mongoose);
var config = require('config');
var sinon = require('sinon');
var EventsEmitter = require('events').EventEmitter;

describe('EventListener', function () {
  before(function () {
    return mongoose.connectAsync(config.get('Hoist.mongo.db'));
  });
  after(function () {
    return mongoose.disconnectAsync();
  });
  describe('#listen', function () {
    var _subscription;
    var eventListener;
    var _conn;
    var _bucket;
    before(function () {
      _conn = {
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
          clientId: '2191990946.3236346965',
          clientSecret: '4891ea22c6647aa0982700af5b2c6ea2'
        }
      };
      _subscription = {
        _id: 'subscriptionId',
        application: 'testAppId',
        endpoints: ['Invoices', 'Contacts'],
        environment: 'test',
        eventEmitter: new EventsEmitter()
      };
      _bucket = {
        _id: 'bucketId'
      };
      sinon.stub(EventListener.prototype, 'createListeners');
      eventListener = new EventListener(_subscription, _conn, _bucket);
      eventListener.listen();
    });
    after(function () {
      EventListener.prototype.createListeners.restore();
    });
    it('calls createListeners with the subscriptions endpoints', function () {
      expect(EventListener.prototype.createListeners.firstCall.args[0]).to.eql('Invoices');
      expect(EventListener.prototype.createListeners.secondCall.args[0]).to.eql('Contacts');
    });
  });
  describe('#createListeners', function () {
    var _subscription;
    var eventListener;
    var _conn;
    var _bucket;
    before(function () {
      _conn = {
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
          clientId: '2191990946.3236346965',
          clientSecret: '4891ea22c6647aa0982700af5b2c6ea2'
        }
      };
      _subscription = {
        _id: 'subscriptionId',
        application: 'testAppId',
        endpoints: ['Invoices', 'Contacts'],
        environment: 'test',
        eventEmitter: new EventsEmitter()
      };
      _bucket = {
        _id: 'bucketId'
      };
      eventListener = new EventListener(_subscription, _conn, _bucket);
      eventListener.createListeners('Invoices');
    });
    it('sets up a new event listener for that endpoint', function () {
      expect(_subscription.eventEmitter.listeners('connectorKey:new:invoice').length).to.eql(1);
    });
    it('sets up a modified event listener for that endpoint', function () {
      expect(_subscription.eventEmitter.listeners('connectorKey:modified:invoice').length).to.eql(1);
    });
  });
});