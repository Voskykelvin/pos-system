'use strict';

const crypto = require('crypto');

function requestIdMiddleware(req, res, next) {
  const reqId = req.get('x-request-id') || crypto.randomUUID();
  req.id = reqId;
  res.set('X-Request-Id', reqId);
  next();
}

module.exports = { requestIdMiddleware };
