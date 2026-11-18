const createLogger = function () {
  return {
    level: 'INFO',
    debug: function () {},
    info: function () {},
    warn: function () {},
    error: function () {}
  };
};
module.exports.createLogger = createLogger;
