'use strict';
require('../bootstrap');
var PollerService = require('../../lib/poller_service');
var sinon = require('sinon');
var BBPromise = require('bluebird');
var expect = require('chai').expect;
var model = require('hoist-model');
var Subscription = model.Subscription;
var ConnectorSetting = model.ConnectorSetting;
var Bucket = model.Bucket;
var SubscriptionWrapper = require('../../lib/subscription_wrapper');

describe('PollerService', function () {
  describe('#start', function () {

    var pollerService = new PollerService();
    before(function () {
      sinon.stub(pollerService, 'poll').returns(BBPromise.delay(2000));
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
        return BBPromise.try(function () {
          return BBPromise.delay(2000);
        }).then(function () {
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
      return expect(_error).to.be.instanceOf(BBPromise.CancellationError);
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
    var _promise;
    var pollerService = new PollerService();
    var _polled = 0;
    before(function (done) {
      pollerService.running = true;
      sinon.stub(pollerService, 'loadSubscriptions').returns(BBPromise.try(function () {
        return [_subscription1, _subscription2];
      }));
      sinon.stub(pollerService, 'pollSubscription').returns(BBPromise.try(function () {
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
      _promise = pollerService.poll();
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
    var subscriptions = [{
      subscription: 1
    }, {
      subscription: 2
    }];
    var _result;
    var mockQuery = {
      populate: sinon.stub(),
      exec: sinon.stub()
    };
    before(function () {
      mockQuery.populate.returnsThis();
      mockQuery.exec.returns(BBPromise.resolve(subscriptions));
      var pollerService = new PollerService();
      sinon.stub(Subscription, 'find').returns(mockQuery);
      _result = pollerService.loadSubscriptions();
    });
    after(function () {
      Subscription.find.restore();
    });
    it('loads all subscriptions from the database', function () {
      return expect(Subscription.find)
        .to.have.been.calledWith({});
    });
    it('should populate application', function () {
      return expect(mockQuery.populate)
        .to.have.been.calledWith('application');
    });
    it('returns subscriptions', function () {
      return expect(_result).to.become(subscriptions);
    });
  });
  describe('#pollSubscriptions', function () {
    var subscription = {
      application: {
        _id: 'application'
      },
      connector: 'connector'
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
      sinon.stub(ConnectorSetting, 'findOneAsync').returns(BBPromise.resolve(connectorSetting));
      sinon.stub(Bucket, 'findAsync').returns(BBPromise.resolve(buckets));

      sinon.stub(pollerService, 'pollContext').returns(BBPromise.resolve(null));
      sinon.stub(SubscriptionWrapper.prototype, 'save').returns(BBPromise.resolve(null));
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

  });
});
