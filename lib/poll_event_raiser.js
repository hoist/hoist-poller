import logger from '@hoist/logger';
import Promise from 'bluebird';
Promise.config({
  cancellation: true
});
import {
  ConnectorSetting,
  Subscription
} from '@hoist/model';
import moment from 'moment';
import {
  RabbitPollQueue
} from './rabbit_poll_queue';
/**
@class PollEventRaiser
raises events on the polling queue for poll runners to pick off based on when polls are due
*/

export class PollEventRaiser {
  /**
  creates a new PollEventRaiser
  */
  constructor() {
      this._logger = logger.child({
        cls: 'PollEventRaiser'
      });
      this._pollQueue = new RabbitPollQueue();
    }
    /**
    start the main loop for raising events
    */
  run() {
    this._loop = Promise.resolve()
      .then(() => {
        return this.processSubscriptions();
      });
  }
  loadPendingSubscriptions() {
    return Promise.resolve()
      .then(() => {
        //find subscriptions that are either inactive,
        //or stuck active from more than 30 minutes ago
        //and that need to be polled
        return Subscription.findAsync({
          $and: [{
            $or: [{
              active: false
            }, {
              $and: [{
                active: true
              }, {
                updatedAt: {
                  $lt: moment.utc().subtract(30, 'minutes').toDate()
                }
              }]
            }]
          }, {
            $or: [{
              nextPoll: {
                $lte: moment.utc()
              }
            }, {
              nextPoll: {
                $exists: false
              }
            }, {
              nextPoll: null
            }]
          }]
        })
      });
  }
  raiseSubscriptions(subscriptions) {
    return Promise.resolve()
      .then(() => {
        return Promise.all(subscriptions.map((subscription) => {
          return this._pollQueue.raiseSubscription(subscription);
        }));
      });
  }
  upsertMissingSubscriptions() {
    return Promise.resolve()
      .then(() => {
        //load all connector key
        return ConnectorSetting.find({
          $and: [{
            subscribedEvents: {
              $exists: true
            }
          }, {
            subscribedEvents: {
              $ne: []
            }
          }]
        });
      }).then((connectorInstances) => {
        return Promise.all(connectorInstances.map((connectorInstance) => {
          return Subscription.findOne({
            connector: connectorInstance.key,
            application: connectorInstance.application,
            environment: connectorInstance.environment,
            endpoints: connectorInstance.subscribedEvents
          }).then((subscription) => {
            if (!subscription) {
              return Subscription.updateAsync({
                connector: connectorInstance.key,
                application: connectorInstance.application,
                environment: connectorInstance.environment,
              }, {
                $set: {
                  endpoints: connectorInstance.subscribedEvents,
                  nextPoll: null
                }
              }, {
                upsert: true
              });
            }
          });
        }));
      });
  }
  processSubscriptions() {
    return this.upsertMissingSubscriptions()
      .then(() => {
        return this.loadPendingSubscriptions()
          .then((subscriptions) => {
            if (subscriptions.length < 1) {
              return Promise.delay(200);
            }
            return this.raiseSubscriptions(subscriptions);
          }).then(() => {
            delete this._loop;
            this._loop = this.processSubscriptions();
          });
      })
  }
  stop() {
    return Promise.resolve()
      .then(() => {
        if (this._loop) {
          this._loop.cancel();
          delete this._loop;
        }
      });
  }
}
