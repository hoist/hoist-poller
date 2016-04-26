import {
  RabbitConnectorBase
} from '@hoist/broker';
export class RabbitPollQueue extends RabbitConnectorBase {
  raiseSubscription(subscription) {
    return this._openChannel()
      .then((channel) => {
        return Promise.all([
          channel.assertExchange('hoist.poller', 'topic'),
          channel.assertQueue('hoist.poller', {
            durable: true
          })
        ]).then(() => {
          return channel.bindQueue('hoist.poller', 'hoist.poller', '*');
        }).then(() => {
          let drained = new Promise((resolve) => {
            channel.on('drain', resolve);
          });
          let result = channel.publish('hoist.poller', `subscription.${subscription._id}`, new Buffer(JSON.stringify({
            subscriptionId: subscription._id
          })), {
            mandatory: true,
            persistent: true,
            priority: 3,
            appId: 'HoistPoller',
            type: 'HoistPoller'
          });
          return result || drained;
        });
      });
  }
  stop() {
    if (this_consumer) {
      this._consumer.channel.cancel(this._consumer.consumerTag);
      delete this._consumer;
    }
  }
  listen(onMessage) {
    return this._openChannel()
      .then((channel) => {
        return Promise.all([
          channel.assertExchange('hoist.poller', 'topic'),
          channel.assertQueue('hoist.poller', {
            durable: true
          })
        ]).then(() => {
          return channel.bindQueue('hoist.poller', 'hoist.poller', '*');
        }).then(() => {
          return channel.consume('hoist.poller', (message) => {
            if (message === null) {
              //no more messages, the consumer has been cancelled
              let connection = channel.connection;
              return channel.close().then(() => {
                this._logger.debug('connection close');
                return connection.close();
              });
            } else {
              if (onMessage) {
                onMessage(JSON.parse(message.content.toString()), () => {
                  channel.ack(message);
                });
              }
            }
          }).then(({
            consumerTag
          }) => {
            this._consumer = {
              channel,
              consumerTag
            };
          });
        });
      });
  }
}
