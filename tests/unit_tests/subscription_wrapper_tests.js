'use strict';
import {
  Subscription
}
from '@hoist/model';
import SubscriptionWrapper from '../../lib/subscription_wrapper';
import {
  expect
}
from 'chai';
import sinon from 'sinon';

describe('SubscriptionWrapper', function () {
  var subscriptionWrapper;
  var subscription;
  describe('#get', function () {

    before(function () {
      subscription = new Subscription({
        meta: {
          existingKey: 'value'
        }
      });
      subscriptionWrapper = new SubscriptionWrapper(subscription);
    });
    it('returns existing properties', function () {
      return expect(subscriptionWrapper.get('existingKey')).to.eql('value');
    });
    it('returns undef if property doesn\'t exist', function () {
      return expect(subscriptionWrapper.get('nothing')).to.not.exist;
    });
  });
  describe('#set', function () {
    before(function () {
      subscription = new Subscription({
        meta: {
          existingKey: 'value'
        }
      });
      subscriptionWrapper = new SubscriptionWrapper(subscription);
    });
    it('updates existing properties', function () {
      subscriptionWrapper.set('existingKey', 'newValue');
      return expect(subscription.meta.existingKey).to.eql('newValue');
    });
    it('creates new properties', function () {
      subscriptionWrapper.set('newKey', 'newValue');
      return expect(subscription.meta.newKey).to.eql('newValue');
    });
  });
  describe('#save', function () {
    before(function () {
      subscription = new Subscription({
        meta: {
          existingKey: 'value'
        }
      });
      subscriptionWrapper = new SubscriptionWrapper(subscription);
      sinon.stub(subscription, 'saveAsync').returns(Promise.resolve(null));
      return subscriptionWrapper.save();
    });
    after(function () {
      subscription.saveAsync.restore();
    });
    it('calls save on underlying subscription', function () {
      return expect(subscription.saveAsync).to.have.been.called;
    });
  });
});
