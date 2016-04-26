import moment from 'moment';
import {
  Subscription,
  ConnectorSetting
} from '@hoist/model';
import '../fixtures/db';
import {
  PollEventRaiser
} from '../../lib/poll_event_raiser';
import {
  expect
} from 'chai';

describe('PollEventRaiser', function () {
  this.timeout(5000);
  let _eventRaiser;
  before(() => {
    _eventRaiser = new PollEventRaiser();
  })
  describe('#raiseSubscriptions', () => {
    let subscription1 = {

    };
    let subscription2 = {

    };

  });
  describe('#upsertMissingSubscriptions', () => {
    let subscriptionSetupFully = new Subscription({
      application: 'test-app',
      connector: 'test-connector',
      environment: 'live',
      active: false,
      endpoints: ['event1', 'event2'],
      nextPoll: moment.utc().subtract('4', 'minutes')
    });
    let connectorSetupFully = new ConnectorSetting({
      application: 'test-app',
      key: 'test-connector',
      name: 'connector-1',
      environment: 'live',
      subscribedEvents: ['event1', 'event2']
    });
    let subscriptionWithDifferentEndpoints = new Subscription({
      application: 'test-app',
      connector: 'test-connector2',
      environment: 'live',
      active: false,
      endpoints: ['event2'],
      nextPoll: moment.utc().subtract('4', 'minutes')
    });
    let connectorWithDifferentEndpoints = new ConnectorSetting({
      application: 'test-app',
      key: 'test-connector2',
      name: 'connector-2',
      environment: 'live',
      subscribedEvents: ['event1', 'event3']
    });
    let connectorWithoutSubscription = new ConnectorSetting({
      application: 'test-app',
      key: 'test-connector3',
      name: 'connector-3',
      environment: 'live',
      subscribedEvents: ['event4', 'event2']
    });
    before(() => {
      return Promise.all([
        subscriptionSetupFully.saveAsync(),
        connectorSetupFully.saveAsync(),
        subscriptionWithDifferentEndpoints.saveAsync(),
        connectorWithDifferentEndpoints.saveAsync(),
        connectorWithoutSubscription.saveAsync()
      ]).then(() => {
        return _eventRaiser.upsertMissingSubscriptions();
      });
    })
    it('should leave connector settings with matching endpoints alone', () => {
      return Subscription.findOneAsync({
        _id: subscriptionSetupFully._id
      }).then((subscription) => {
        console.log(subscription);
        return expect(subscription.nextPoll).to.eql(subscriptionSetupFully.nextPoll);
      });
    });
    it('should create missing subscription objects', () => {
      return Subscription.findOneAsync({
        connector: 'test-connector3',
        application: 'test-app',
        environment: 'live'
      }).then((subscription) => {
        return expect(subscription.endpoints).to.eql(['event4', 'event2']) &&
          expect(subscription.nextPoll).to.eql(null);
      })
    });
    it('should update subscriptions that have missmatched events', () => {
      return Subscription.findOneAsync({
          _id: subscriptionWithDifferentEndpoints._id
        })
        .then((subscription) => {
          return expect(subscription.endpoints).to.eql(connectorWithDifferentEndpoints.subscribedEvents) &&
            expect(subscription.nextPoll).to.eql(null);
        });
    })
    after(() => {
      return Subscription.removeAsync({}).then(() => {
        return ConnectorSetting.removeAsync({});
      });
    });
  });
  describe('#loadPendingSubscriptions', () => {
    let baseSubscription = {
      _id: 's1',
      application: 'test-app',
      connector: 'test-connector',
      environment: 'live',
      active: false,
      nextPoll: moment.utc().subtract('4', 'minutes')
    };
    let subscriptionWithNextPollInPast = baseSubscription;
    let subscriptionWithoutNextPollDate = Object.assign({}, baseSubscription, {
      _id: 's2',
      application: 'test-app2',
      nextPoll: null
    });
    let subscriptionWithNextPollInFuture = Object.assign({}, baseSubscription, {
      _id: 's3',
      application: 'test-app3',
      nextPoll: moment.utc().add(5, 'minutes')
    });
    let subscriptionWithNextPollInPastButActive = Object.assign({}, baseSubscription, {
      _id: 's4',
      application: 'test-app4',
      active: true
    });
    let subscriptionActiveButModifiedLapsed = Object.assign({}, baseSubscription, {
      _id: 's5',
      application: 'test-app5',
      active: true,
      updatedAt: moment.utc().subtract(32, 'minutes'),
      createdAt: moment.utc().subtract(1, 'day')
    });
    let _result;

    before(() => {
      _result = Promise.all([
        subscriptionWithNextPollInPast,
        subscriptionWithoutNextPollDate,
        subscriptionWithNextPollInFuture,
        subscriptionWithNextPollInPastButActive,
        subscriptionActiveButModifiedLapsed
      ].map((s) => {
        return new Subscription(s);
      }).map(s => {
        return s.saveAsync()
      })).then(() => {
        return Subscription.updateAsync({
          _id: subscriptionActiveButModifiedLapsed
        }, {
          $set: {
            updatedAt: subscriptionActiveButModifiedLapsed.updatedAt
          }
        });
      }).then(() => {
        return _eventRaiser.loadPendingSubscriptions();
      });
    });
    it('should succeed', () => {
      return expect(_result).to.be.fulfilled;
    });
    it('should return the correct number of subscriptions', () => {
      return _result.then((loadedSubscriptions) => {
        return expect(loadedSubscriptions.length).to.eql(3);
      });
    });
    it('should return subscription with next poll in past', () => {
      return _result.then((loadedSubscriptions) => {
        return expect(loadedSubscriptions.map((s) => s._id)).to.include(subscriptionWithNextPollInPast._id);
      });
    });
    it('should return subscription with no next poll', () => {
      return _result.then((loadedSubscriptions) => {
        return expect(loadedSubscriptions.map((s) => s._id)).to.include(subscriptionWithoutNextPollDate._id);
      });
    });
    it('should return subscription active but modifed more than 30 mins ago', () => {
      return _result.then((loadedSubscriptions) => {
        return expect(loadedSubscriptions.map((s) => s._id)).to.include(subscriptionActiveButModifiedLapsed._id);
      });
    })
    after(() => {
      return Promise.resolve(Subscription.removeAsync({}));
    });
  });
});
