import {
  _mongoose
} from '@hoist/model';
import config from 'config';
import Bluebird from 'bluebird';
_mongoose.set('debug', true);

before(function(){
  this.timeout(5000);
  return _mongoose.connectAsync(config.get('Hoist.mongo.core.connectionString'), {
    config: {
      autoIndex: false
    }
  }).then(()=>{
    return Bluebird.delay(2000);
  });

});
after(function () {
  this.timeout(5000);
  Bluebird.promisifyAll(_mongoose.connection.db);
  return _mongoose.connection.db.dropDatabaseAsync()
    .then(() => {
      console.log('dropping db');
      return _mongoose.disconnectAsync();
    });
});
