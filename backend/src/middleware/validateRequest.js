function validateRequest(schema, source = 'body') {
  return function validateRequestMiddleware(req, _res, next) {
    try {
      req[source] = schema.parse(req[source] || {});
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { validateRequest };
