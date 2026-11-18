function createNotFoundMiddleware(options) {
  return function notFoundMiddleware(req, res, next) {
    res.status(404).json({
      success: false,
      message: 'Resource not found',
      data: { path: req.originalUrl || req.url }
    });
  };
}

module.exports = { createNotFoundMiddleware };
