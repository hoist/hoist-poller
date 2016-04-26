import {
  PollEventRaiser
} from '../../lib/poll_event_raiser';
import {
  expect
} from 'chai';
import sinon from 'sinon';
import Promise from 'bluebird';

Promise.config({
  cancellation: true
});

describe('PollEventRaiser', () => {
  let pollEventRaiser;
  before(() => {
    pollEventRaiser = new PollEventRaiser();
  });
  describe('#stop', () => {
    let loop;
    let called;
    before(() => {
      called = false;
      loop = Promise.delay(40).then(() => {
        called = true
      });
      pollEventRaiser._loop = loop;
      pollEventRaiser.stop();
    });
    it('cancels the loop', () => {
      return Promise.delay(50).then(() => {
        return expect(called).to.be.false
      });
    });
    it('deletes the loop', () => {
      return expect(pollEventRaiser._loop).to.not.exist;
    });
    after(() => {
      loop = null;
    });
  });
  describe('#run', () => {
    let subscriptions = [{
      _id: 1
    }];
    before(() => {
      sinon.stub(pollEventRaiser, 'loadPendingSubscriptions', () => {
        return Promise.resolve(subscriptions);
      });
      sinon.stub(pollEventRaiser, 'raiseSubscriptions').returns(Promise.delay(100));
      pollEventRaiser.run();
    });
    it('saves the loop', () => {
      return expect(pollEventRaiser._loop).to.exist;
    });
    it('calls loadPendingSubscriptions', () => {
      return expect(pollEventRaiser.loadPendingSubscriptions).to.have.been.called;
    });
    it('it raises subscriptions', () => {
      return expect(pollEventRaiser.raiseSubscriptions).to.have.been.calledWith(subscriptions);
    });
    after(() => {
      return pollEventRaiser.stop()
        .then(() => {
          pollEventRaiser.loadPendingSubscriptions.restore();
          pollEventRaiser.raiseSubscriptions.restore();
        });
    });
  });
});
