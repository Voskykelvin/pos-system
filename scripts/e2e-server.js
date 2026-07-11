try {
  require('moment').suppressDeprecationWarnings = true;
} catch {
  // pg-mem owns this optional test-only dependency.
}

const { start } = require('../server');
const logger = require('../utils/logger');

start().catch((error) => {
  logger.error('Failed to start browser-test server', error);
  process.exit(1);
});
