'use strict';
var poller = require('./lib/poller.js');
process.title = 'poller' + process.pid;
var shutdown = function () {
  var timeout = setTimeout(function () {
    console.log('forcing shutdown');
    process.exit(1);
  }, 2000);
  console.log('shutting down execution agent');
  process.nextTick(function () {
    poller.stop();
    clearTimeout(timeout);
    console.log('shutdown complete');
    process.exit(0);
  });
};


process.on('message', function (msg) {
  if (msg === 'shutdown') {
    shutdown();
  }
});
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

poller.start();
console.log('started');
