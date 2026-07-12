'use strict';

const isProduction = process.env.NODE_ENV === 'production';
const base = {
  service: process.env.SERVICE_NAME || 'jijenge-pos',
  environment: process.env.NODE_ENV || 'development',
  version: process.env.RENDER_GIT_COMMIT || process.env.APP_VERSION || 'local'
};

function info(message, meta = {}) {
  if (isProduction) {
    console.log(JSON.stringify({ ...base, level: 'info', timestamp: new Date().toISOString(), message, ...meta }));
  } else {
    console.log(`[INFO] ${message}`, Object.keys(meta).length ? meta : '');
  }
}

function warn(message, meta = {}) {
  if (isProduction) {
    console.warn(JSON.stringify({ ...base, level: 'warn', timestamp: new Date().toISOString(), message, ...meta }));
  } else {
    console.warn(`[WARN] ${message}`, Object.keys(meta).length ? meta : '');
  }
}

function error(message, err, meta = {}) {
  const errDetails = err ? { error: err.message, stack: err.stack } : {};
  if (isProduction) {
    console.error(JSON.stringify({ ...base, level: 'error', timestamp: new Date().toISOString(), message, ...errDetails, ...meta }));
  } else {
    console.error(`[ERROR] ${message}`, err || '', Object.keys(meta).length ? meta : '');
  }
}

module.exports = { info, warn, error };
