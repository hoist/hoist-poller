'use strict';


module.exports = function () {
  return module.exports.process.apply(this,Array.prototype.slice.apply(arguments));
};

module.exports.process = function () {
  console.log('expect this method to be stubbed');
};
