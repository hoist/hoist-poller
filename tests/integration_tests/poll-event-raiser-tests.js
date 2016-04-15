import moment from 'moment';
import {
  Subscription
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
      nextPoll: null
    });
    let subscriptionWithNextPollInFuture = Object.assign({}, baseSubscription, {
      _id: 's3',
      nextPoll: moment.utc().add(5, 'minutes')
    });
    let subscriptionWithNextPollInPastButActive = Object.assign({}, baseSubscription, {
      _id: 's4',
      active: true
    });
    let subscriptionActiveButModifiedLapsed = Object.assign({}, baseSubscription, {
      _id: 's5',
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
      return Promise.resolve(Subscription.remove({}));
    });
  });
});
