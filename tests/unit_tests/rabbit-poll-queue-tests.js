import {
  RabbitPollQueue
} from '../../lib/rabbit_poll_queue';
import {
  expect
} from 'chai';
import sinon from 'sinon';
describe('RabbitPollQueue', () => {
  let rabbitPollQueue;
  before(() => {
    rabbitPollQueue = new RabbitPollQueue();
  });
  it('should inherit from RabbitConnectorBase', () => {
    return expect(rabbitPollQueue._openChannel).to.exist;
  });
  describe('#raiseSubscription', () => {
    let stubChannel = {
      assertQueue: sinon.stub().returns(Promise.resolve()),
      bindQueue: sinon.stub().returns(Promise.resolve()),
      publish: sinon.stub().returns(true),
      assertExchange: sinon.stub().returns(Promise.resolve()),
      on: sinon.stub()
    };
    before(() => {
      sinon.stub(rabbitPollQueue, '_openChannel').returns(Promise.resolve(stubChannel));
      return rabbitPollQueue.raiseSubscription({
        _id: 'subscriptionid1'
      });
    });
    after(() => {
      rabbitPollQueue._openChannel.restore();
    })
    it('should ensure exchange exists', () => {
      return expect(stubChannel.assertExchange)
        .to.have.been.calledWith('hoist.poller', 'topic');
    });
    it('ensures the event queue exists', () => {
      return expect(stubChannel.assertQueue)
        .to.have.been.calledWith('hoist.poller', {
          durable: true
        });
    });
    it('should bind queue to exchange', () => {
      return expect(stubChannel.bindQueue)
        .to.have.been.calledWith('hoist.poller', 'hoist.poller', '*');
    });
    it('should raise a rabbitmq event', () => {
      return expect(stubChannel.publish)
        .to.have.been.calledWith('hoist.poller', `subscription.subscriptionid1`, sinon.match(b => {
          return expect(b.toString()).to.eql(JSON.stringify({
            subscriptionId: 'subscriptionid1'
          }));
        }), {
          mandatory: true,
          persistent: true,
          priority: 3,
          appId: 'HoistPoller',
          type: 'HoistPoller'
        });
    });
  });
});
