'use strict';
import PollerService from '../../lib/poller_service';
import sinon from 'sinon';
import {
  expect
}
from 'chai';
import {
  Subscription, ConnectorSetting, Bucket, Application, BouncerToken
}
from '@hoist/model';
import SubscriptionWrapper from '../../lib/subscription_wrapper';
import testPoller from '../fixtures/test_connectors/hoist-connector-test/current/lib/poll';
import EventPipeline from '@hoist/events-pipeline';
import moment from 'moment';
import Bluebird from 'bluebird';

describe('PollerService', function () {
  describe('#start', function () {

    var pollerService = new PollerService();
    before(function () {
      sinon.stub(pollerService, 'poll').returns(Bluebird.delay(2000));
      return pollerService.start();
    });
    it('marks service as running', function () {
      return expect(pollerService.running).to.be.true;
    });
    it('calls poll', function () {
      return expect(pollerService.poll)
        .to.have.been.called;
    });
    it('saves running promise', function () {
      return expect(pollerService.loop)
        .to.exist;
    });
    it('marks promise as cancellable', function () {
      return expect(pollerService.loop.isCancellable()).to.be.true;
    });
    after(function () {
      pollerService.poll.restore();
    });
  });
  describe('#stop', function () {
    var pollerService = new PollerService();
    var _error;
    before(function () {
      pollerService.running = true;

      function loop() {
        return Bluebird.delay(2000)
          .then(function () {
            return loop();
          });
      }
      pollerService.loop = loop().cancellable().catch(function (err) {
        _error = err;
      });
      pollerService.stop();

    });
    it('marks service as stopped', function () {
      return expect(pollerService.running).to.be.false;
    });
    it('cancels loop', function () {
      return expect(_error).to.be.instanceOf(Bluebird.CancellationError);
    });
    it('deletes loop', function () {
      return expect(pollerService.loop).to.not.exist;
    });
  });
  describe('#poll', function () {
    var _subscription1 = {
      subscription: 1
    };
    var _subscription2 = {
      subscription: 2
    };
    var pollerService = new PollerService();
    var _polled = 0;

    before(function (done) {
      pollerService.running = true;
      sinon.stub(pollerService, 'loadSubscriptions').returns(Bluebird.resolve().then(function () {
        return [_subscription1, _subscription2];
      }));
      sinon.stub(pollerService, 'pollSubscription').returns(Bluebird.resolve().then(function () {
        return true;
      }));
      pollerService.originalPoll = pollerService.poll;
      sinon.stub(pollerService, 'poll', function () {
        _polled++;
        if (_polled > 1) {
          done();
        } else {
          return this.originalPoll();
        }
      });
      return pollerService.poll();
    });
    it('loads all subscriptions', function () {
      return expect(pollerService.loadSubscriptions)
        .to.have.been.called;
    });
    it('polls each subscription', function () {
      return expect(pollerService.pollSubscription)
        .to.have.been.calledWith(_subscription1)
        .and.to.have.been.calledWith(_subscription2);
    });
    it('loops', function () {
      return expect(_polled).to.eql(2);
    });
  });
  describe('#loadSubscriptions', function () {
    var subscription = new Subscription({
      _id: 'subscriptionid',
      meta: {
        subscription: 1
      }
    });
    var _result;
    var mockQuery = {
      populate: sinon.stub(),
      exec: sinon.stub()
    };
    var clock;
    before(function () {
      clock = sinon.useFakeTimers();
      mockQuery.populate.returnsThis();
      mockQuery.exec.returns(Promise.resolve(subscription));
      var pollerService = new PollerService();
      sinon.stub(Subscription, 'findOneAndUpdate').returns(mockQuery);
      _result = pollerService.loadSubscriptions();

    });
    after(function () {
      clock.restore();
      Subscription.findOneAndUpdate.restore();
    });
    it('loads all subscriptions from the database', function () {
      return expect(Subscription.findOneAndUpdate)
        .to.have.been.calledWith({
          $and: [{
            _id: {
              $nin: []
            }
          }, {
            $or: [{
              active: false
            }, {
              active: {
                $exists: false
              }
            }]
          }, {
            $or: [{
              nextPoll: {
                $lt: moment().utc().toDate()
              }
            }, {
              nextPoll: {
                $exists: false
              }
            }]
          }]
        }, {
          $set: {
            active: true
          }
        });
    });
    it('should populate application', function () {
      return expect(mockQuery.populate)
        .to.have.been.calledWith('application');
    });
    it('returns subscriptions', function () {
      return expect(_result).to.become([subscription]);
    });
  });
  describe('#pollSubscriptions', function () {
    var subscription = {
      application: {
        _id: 'application'
      },
      connector: 'connector',
      toObject: sinon.stub().returnsThis()
    };
    var connectorSetting = {
      key: 'connector'
    };
    var buckets = [{
      id: 1
    }, {
      id: 2
    }];
    var pollerService = new PollerService();
    var contextMatcher = sinon.match(function (context) {
      return context.subscription._subscription === subscription &&
        context.application === subscription.application &&
        context.connectorSettings === connectorSetting &&
        context.buckets === buckets;
    });
    before(function () {
      sinon.stub(ConnectorSetting, 'findOneAsync').returns(Promise.resolve(connectorSetting));
      sinon.stub(Bucket, 'findAsync').returns(Promise.resolve(buckets));

      sinon.stub(pollerService, 'pollContext').returns(Promise.resolve(null));
      sinon.stub(SubscriptionWrapper.prototype, 'save').returns(Promise.resolve(null));
      pollerService.pollSubscription(subscription);
    });
    after(function () {
      ConnectorSetting.findOneAsync.restore();
      Bucket.findAsync.restore();
      SubscriptionWrapper.prototype.save.restore();
    });
    it('loads connector settings', function () {
      return expect(ConnectorSetting.findOneAsync)
        .to.have.been.calledWith({
          application: 'application',
          environment: 'live',
          key: 'connector'
        });
    });
    it('loads buckets that have correct authentication tokens', function () {
      return expect(Bucket.findAsync)
        .to.have.been.calledWith({
          application: 'application',
          environment: 'live',
          'meta.authToken.connector': {
            $exists: true
          }
        });
    });
    it('polls every bucket', function () {
      return expect(pollerService.pollContext)
        .to.have.been.calledWith(contextMatcher, buckets[0])
        .and.calledWith(contextMatcher, buckets[1]);
    });
    it('polls without a bucket', function () {
      return expect(pollerService.pollContext)
        .to.have.been.calledWithExactly(contextMatcher);
    });
    it('polls the correct number of times', function () {
      return expect(pollerService.pollContext)
        .to.have.been.calledThrice;
    });
    it('saves the subscription', function () {
      return expect(SubscriptionWrapper.prototype.save)
        .to.have.been.called;
    });
  });
  describe('#pollContext', function () {
    var pollerService = new PollerService();
    var context = {
      connectorSettings: {
        connectorType: 'hoist-connector-test',
        key: 'test-connector'
      },
      subscription: {
        _id: 'subscription'
      },
      application: new Application()
    };
    var bucket = new Bucket({
      meta: {
        authToken: {
          'test-connector': 'bouncerToken'
        }
      }
    });
    var bouncerToken = {};
    before(function () {
      sinon.stub(BouncerToken, 'findOneAsync').returns(Promise.resolve(bouncerToken));
      sinon.stub(testPoller, 'process').returns(Promise.resolve(null));
      sinon.stub(pollerService, 'raiseEvent').returns(null);
      pollerService.pollContext(context, bucket);
    });
    after(function () {
      testPoller.process.restore();
      BouncerToken.findOneAsync.restore();
    });
    it('calls poller for connector', function () {
      return expect(testPoller.process)
        .to.have.been.called;
    });
    it('sends a raise event callback', function () {
      var payload = {
        payload: true
      };
      testPoller.process.getCall(0).args[1].call(null, 'eventname', payload);
      return expect(pollerService.raiseEvent)
        .to.have.been.calledWith(testPoller.process.getCall(0).args[0], 'eventname', payload);
    });
  });
  describe('#raiseEvent', function () {
    var pollerService = new PollerService();
    var payload = {
      payload: true
    };
    var context = {
      bucket: {
        bucket: true
      },
      application: {
        application: true
      }
    };
    before(function () {
      sinon.stub(EventPipeline.prototype, 'raise').returns(Promise.resolve(null));
      pollerService.raiseEvent(context, 'eventName', payload);
    });
    after(function () {
      EventPipeline.prototype.raise.restore();
    });
    it('raises event', function () {
      return expect(EventPipeline.prototype.raise)
        .to.have.been.calledWith({
          application: context.application,
          bucket: context.bucket,
          environment: 'live'
        }, 'eventName', payload);
    });
  });
});
