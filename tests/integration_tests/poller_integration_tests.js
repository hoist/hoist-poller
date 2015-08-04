'use strict';
import PollerService from '../../lib/poller_service';
import Bluebird from 'bluebird';
import config from 'config';
import sinon from 'sinon';
import pollMethod from '../fixtures/test_connectors/hoist-connector-test/current/lib/poll';
import {
  expect
}
from 'chai';
import {
  Organisation,
  Application,
  ConnectorSetting,
  Subscription,
  _mongoose
}
from '@hoist/model';


Bluebird.promisifyAll(_mongoose);
describe('Integration', () => {
  describe('Polling a Subscription', () => {
    before(() => {
      return _mongoose.connectAsync(config.get('Hoist.mongo.core.connectionString'))
        .then(() => {
          return Promise.all([
            new Organisation({
              _id: 'org',
              name: 'test-org',
              slug: 'org'
            }).saveAsync(),
            new Application({
              _id: 'app',
              name: 'test-app',
              slug: 'app',
              organisation: 'org'
            }).saveAsync(),
            new ConnectorSetting({
              _id: 'connector',
              application: 'app',
              environment: 'live',
              name: 'test-connector',
              connectorType: 'hoist-connector-test',
              settings: {
                something: true
              },
              key: 'test-connector-key'
            }).saveAsync(),
            new Subscription({
              _id: 'subscription',
              connector: 'test-connector-key',
              endpoints: ['enpoint1'],
              application: 'app',
              environment: 'live',
              nextPoll: new Date()
            }).saveAsync()
          ]).catch((err) => {
            console.log(err);
            throw err;
          });
        });
    });
    after(() => {
      return Promise.all([
        Organisation.removeAsync({}),
        Application.removeAsync({}),
        ConnectorSetting.removeAsync({}),
        Subscription.removeAsync({})
      ]).then(()=>{
        return _mongoose.disconnectAsync();
      });
    });
    describe('after poll has run', function () {
      this.timeout(5000);
      let pollerService;
      let recievedSettings;
      before(() => {
        sinon.stub(pollMethod, 'process', (...settings) => {
          recievedSettings = settings;
          return Promise.resolve();
        });
        pollerService = new PollerService();
        return Promise.resolve(pollerService.start())
          .then(() => {
            return Bluebird.delay(2000);
          }).then(() => {
            return pollerService.stop();
          });
      });
      it('should mark subscription inactive', () => {
        return Subscription.findOneAsync({}).then((subscription) => {
          return expect(subscription.active).to.be.false;
        });
      });
      it('passes settings to poll', () => {
        return expect(recievedSettings[0].settings.something).to.eql(true);
      });
      after(() => {
        pollMethod.process.restore();
      });
    });
  });
});
