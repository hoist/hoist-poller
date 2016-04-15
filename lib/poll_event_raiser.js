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
    }
    /**
    start the main loop for raising events
    */
  run() {
    console.log('setting up loop');
    this._loop = Promise.resolve()
      .then(() => {
        return this.processSubscriptions();
      });
    console.log('returning');
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
        return;
      });
  }
  processSubscriptions() {
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
