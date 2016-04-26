import {
  PollExecutor
} from '../../lib/poll_executor';
import {
  SubscriptionWrapper
} from '../../lib/subscription_wrapper';
import sinon from 'sinon';
import {
  expect
} from 'chai';
import {
  Subscription,
  ConnectorSetting,
  Bucket,
  BouncerToken
} from '@hoist/model';
describe('PollExecutor', () => {
  let _executor;
  before(() => {
    _executor = new PollExecutor();
  })
  describe('#getPollerMethod', () => {
    let onComplete = sinon.stub();
    let context = {
      buckets: [{
        name: 'bucket1',
        bouncerToken: {}
      }],
      connectorInstance: {
        settings: {},
        key: 'connector-key'
      },
      subscription: {
        asObject: {},
        toObject() {
          return this.asObject;
        }
      },
      application: {
        asObject: {},
        toObject() {
          return this.asObject;
        }
      },
      organisation: {
        asObject: {},
        toObject() {
          return this.asObject;
        }
      }
    };
    let pollerMethod = sinon.stub().returns(Promise.resolve());
    pollerMethod.version = 2;
    let subscription = new Subscription();
    describe('with valid data', () => {
      before(() => {
        sinon.stub(_executor, 'loadSubscription')
          .returns(Promise.resolve(subscription));
        sinon.stub(_executor, 'loadContext')
          .returns(Promise.resolve(context));
        sinon.stub(_executor, 'getPollerMethod')
          .returns(Promise.resolve(pollerMethod));
        sinon.stub(_executor, 'raiseEvent')
          .returns(Promise.resolve());
        return _executor.processPoll({
          subscriptionId: 'subscriptionId'
        }, onComplete);
      });
      after(() => {
        _executor.loadSubscription.restore();
        _executor.loadContext.restore();
        _executor.getPollerMethod.restore();
        _executor.raiseEvent.restore();
        pollerMethod.reset();
        onComplete.reset();
      });
      it('loads context from subscription', () => {
        return expect(_executor.loadContext).to.have.been.calledWith({
          subscription
        });
      });
      it('loads subscription', () => {
        return expect(_executor.loadSubscription).to.have.been.calledWith({
          subscriptionId: 'subscriptionId'
        });
      });
      it('should call #onComplete', () => {
        return expect(onComplete).to.have.been.called;
      });
      it('should call pollerMethod', () => {
        return expect(pollerMethod).to.have.been.calledWith(sinon.match((pollContext) => {
          return expect(pollContext.application).to.eql(context.application.asObject) &&
            expect(pollContext.organisation).to.eql(context.organisation.asObject) &&
            expect(pollContext.authorizations.length).to.eql(1) &&
            expect(pollContext.connectorKey).to.eql('connector-key') &&
            expect(pollContext.settings).to.eql(context.connectorInstance.settings) &&
            expect(pollContext.subscription).to.be.instanceOf(SubscriptionWrapper);
        }));
      });
      it('should map raiseEvent', () => {
        let eventName = 'eventName';
        let payload = {};
        let call = pollerMethod.getCall(0);
        return call.args[1].apply(null, [eventName, payload]).then(() => {
          return expect(_executor.raiseEvent).to.have.been.calledWith({
            eventName,
            payload,
            context: call.args[0]
          });
        });
      });
    });
    describe('with no poller method', () => {
      let result;
      before(() => {
        sinon.stub(_executor, 'loadSubscription')
          .returns(Promise.resolve(subscription));
        sinon.stub(_executor, 'loadContext')
          .returns(Promise.resolve(context));
        sinon.stub(_executor, 'getPollerMethod')
          .returns(Promise.resolve(null));
        sinon.stub(_executor, 'raiseEvent')
          .returns(Promise.resolve());
        result = _executor.processPoll({
          subscriptionId: 'subscriptionId'
        }, onComplete);
      });
      after(() => {
        _executor.loadSubscription.restore();
        _executor.loadContext.restore();
        _executor.getPollerMethod.restore();
        _executor.raiseEvent.restore();
        pollerMethod.reset();
        onComplete.reset();
      });
      it('should succeed', () => {
        return expect(result).to.be.fulfilled;
      });
      it('never calls poll', () => {
        return expect(pollerMethod).to.have.not.been.called;
      });
      it('calls onComplete', () => {
        return expect(onComplete).to.have.been.called;
      });
    });
    describe('with no authorized buckets', () => {
      let result;
      let buckets = context.buckets;
      before(() => {
        context.buckets = [];
        sinon.stub(_executor, 'loadSubscription')
          .returns(Promise.resolve(subscription));
        sinon.stub(_executor, 'loadContext')
          .returns(Promise.resolve(context));
        sinon.stub(_executor, 'getPollerMethod')
          .returns(Promise.resolve(pollerMethod));
        sinon.stub(_executor, 'raiseEvent')
          .returns(Promise.resolve());
        result = _executor.processPoll({
          subscriptionId: 'subscriptionId'
        }, onComplete);
      });
      after(() => {
        context.buckets = buckets;
        _executor.loadSubscription.restore();
        _executor.loadContext.restore();
        _executor.getPollerMethod.restore();
        _executor.raiseEvent.restore();
        pollerMethod.reset();
        onComplete.reset();
      });
      it('should succeed', () => {
        return expect(result).to.be.fulfilled;
      });
      it('never calls poll', () => {
        return expect(pollerMethod).to.have.not.been.called;
      });
      it('calls onComplete', () => {
        return expect(onComplete).to.have.been.called;
      });
    });
    describe('with null authorized buckets', () => {
      let result;
      let buckets = context.buckets;
      before(() => {
        context.buckets = null;
        sinon.stub(_executor, 'loadSubscription')
          .returns(Promise.resolve(subscription));
        sinon.stub(_executor, 'loadContext')
          .returns(Promise.resolve(context));
        sinon.stub(_executor, 'getPollerMethod')
          .returns(Promise.resolve(pollerMethod));
        sinon.stub(_executor, 'raiseEvent')
          .returns(Promise.resolve());
        result = _executor.processPoll({
          subscriptionId: 'subscriptionId'
        }, onComplete);
      });
      after(() => {
        context.buckets = buckets;
        _executor.loadSubscription.restore();
        _executor.loadContext.restore();
        _executor.getPollerMethod.restore();
        _executor.raiseEvent.restore();
        pollerMethod.reset();
        onComplete.reset();
      });
      it('should succeed', () => {
        return expect(result).to.be.fulfilled;
      });
      it('never calls poll', () => {
        return expect(pollerMethod).to.have.not.been.called;
      });
      it('calls onComplete', () => {
        return expect(onComplete).to.have.been.called;
      });
    });
  });
  describe('#loadSubscription', () => {
    let subscription = {};
    let query = {
      populate: sinon.stub().returnsThis(),
      exec: sinon.stub().returns(Promise.resolve(subscription))
    };
    let result;
    before(() => {
      sinon.stub(Subscription, 'findOne').returns(query);
      result = _executor.loadSubscription({
        subscriptionId: 'id'
      });
    });
    after(() => {
      Subscription.findOne.restore();
    });
    it('should succeed', () => {
      return expect(result).to.be.fulfilled;
    })
    it('should return result from mongo', () => {
      return expect(result).to.eventually.become(subscription);
    });
    it('should query mongo', () => {
      return expect(Subscription.findOne).to.have.been.calledWith({
        _id: 'id'
      });
    });
    it('populates application', () => {
      return expect(query.populate).to.have.been.calledWith('application');
    });
    it('populates organisation', () => {
      return expect(query.populate).to.have.been.calledWith('application.organisation');
    });
  });
  describe('#getPollerMethod', () => {
    let context = {
      connectorInstance: {
        connectorType: 'test-connector'
      }
    };
    describe('given a connector that has a poll method', () => {
      let result;
      before(() => {
        result = _executor.getPollerMethod({
          context
        });
      });
      it('should succeed', () => {
        return expect(result).to.be.fulfilled;
      });
      it('should import correct function', () => {
        return expect(result).to.eventually.become(require('../fixtures/test_connectors/test-connector/release/lib/poll.js').default);
      });
      after(() => {

      });
    });
    describe('given a connector that has no version', () => {
      let result;
      let testPoll;
      before(() => {
        testPoll = require('../fixtures/test_connectors/test-connector/release/lib/poll.js').default;
        delete testPoll.version;
        result = _executor.getPollerMethod({
          context
        });
      });
      it('should succeed', () => {
        return expect(result).to.be.fulfilled;
      });
      it('should return null', () => {
        return expect(result).to.eventually.become(null);
      });
      after(() => {
        testPoll.version = 2;
      });
    });
    describe('given a connector that has no poll.js', () => {
      let result;
      before(() => {
        context.connectorInstance.connectorType = 'other-connector';
        result = _executor.getPollerMethod({
          context
        });
      });
      it('should succeed', () => {
        return expect(result).to.be.fulfilled;
      });
      it('should return null', () => {
        return expect(result).to.eventually.become(null);
      });
      after(() => {
        context.connectorInstance.connectorType = 'test-connector';
      });
    });
  });
  describe('#loadContext', () => {
    let result;
    let subscription = {
      application: {
        _id: 'app-id',
        organisation: {
          _id: 'org-id'
        }
      },
      connector: 'connector-key'
    }
    let connectorInstance = {
      connectorType: 'test-connector',
      key: 'connector-key'
    };
    let bouncerTokens = [{
      key: 'test-bouncer-token'
    }, {
      key: 'other-bouncer-token'
    }];
    let buckets = [{
      asObject: {
        meta: {
          authToken: 'test-bouncer-token'
        }
      },
      toObject() {
        return this.asObject;
      },
      meta: {
        authToken: {
          'connector-key': 'test-bouncer-token'
        }
      }
    }]
    before(() => {
      sinon.stub(ConnectorSetting, 'findOneAsync')
        .returns(Promise.resolve(connectorInstance));
      sinon.stub(BouncerToken, 'findAsync')
        .returns(Promise.resolve(bouncerTokens));
      sinon.stub(Bucket, 'findAsync')
        .returns(Promise.resolve(buckets));
      result = _executor.loadContext({
        subscription
      });
    });
    it('should succeed', () => {
      return expect(result).to.be.fulfilled;
    });
    it('should load the correct connector', () => {
      return expect(ConnectorSetting.findOneAsync).to.have.been.calledWith({
        key: 'connector-key',
        application: 'app-id'
      });
    });
    it('should load up bouncer tokens for the application/connector', () => {
      return expect(BouncerToken.findAsync).to.have.been.calledWith({
        application: 'app-id',
        environment: 'live',
        connectorKey: 'connector-key',
        connectorType: 'test-connector'
      });
    });
    it('should load up authorized buckets', () => {
      return expect(Bucket.findAsync).to.have.been.calledWith({
        application: 'app-id',
        environment: 'live',
        'meta.authToken.connector-key': {
          $exists: true
        }
      });
    });
    it('should return application on context', () => {
      return result.then((context) => {
        return expect(context.application).to.eql(subscription.application);
      });
    });
    it('should return organisation on context', () => {
      return result.then((context) => {
        return expect(context.organisation).to.eql(subscription.application.organisation);
      });
    });
    it('should return buckets on context', () => {
      return result.then((context) => {
        return expect(context.buckets.length).to.eql(1);
      });
    });
    it('should link bucket to bouncerToken', () => {
      return result.then((context) => {
        return expect(context.buckets[0].bouncerToken).to.eql(bouncerTokens[0]);
      });
    });
    it('should return connector instance on context', () => {
      return result.then((context) => {
        return expect(context.connectorInstance).to.eql(connectorInstance);
      });
    });
    after(() => {
      ConnectorSetting.findOneAsync.restore();
      Bucket.findAsync.restore();
      BouncerToken.findAsync.restore();
    });
  });
})
