'use strict';

const { createApp } = require('./app');
const { loadConfig } = require('./config');

const config = loadConfig();
const app = createApp(config);

const server = app.listen(config.port, () => {
  console.log(
    `version-app v${config.version} listening on :${config.port} (pod=${config.hostname}, broken=${config.broken})`
  );
});

// Graceful shutdown: during a rolling update Kubernetes sends SIGTERM to old
// pods. Fail readiness, finish in-flight requests, then exit.
function shutdown(signal) {
  console.log(`${signal} received, draining connections...`);
  app.locals.state.shuttingDown = true;
  server.close(() => {
    console.log('Server closed, exiting.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
