'use strict';

const express = require('express');
const { renderPage } = require('./page');

function createApp(config) {
  const app = express();
  const startedAt = Date.now();
  const state = { requests: 0, shuttingDown: false };

  app.disable('x-powered-by');

  app.use((req, res, next) => {
    state.requests += 1;
    res.set('X-App-Version', config.version);
    res.set('X-Pod-Name', config.hostname);
    next();
  });

  const versionInfo = () => ({
    app: 'version-app',
    version: config.version,
    color: config.color,
    commit: config.commit,
    buildDate: config.buildDate,
    pod: config.hostname,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    requestsServed: state.requests,
  });

  app.get('/', (req, res) => {
    res.type('html').send(renderPage(versionInfo()));
  });

  app.get('/api/version', (req, res) => {
    // Close the connection so each poll is load-balanced again by the
    // Service. This makes the mix of old/new pods visible during a rollout.
    res.set('Connection', 'close');
    res.json(versionInfo());
  });

  // Liveness: the process is running.
  app.get('/health', (req, res) => {
    res.json({ status: 'UP', version: config.version });
  });

  // Readiness: the pod may receive traffic.
  app.get('/ready', (req, res) => {
    if (config.broken) {
      return res.status(503).json({ status: 'NOT_READY', reason: 'simulated faulty release' });
    }
    if (state.shuttingDown) {
      return res.status(503).json({ status: 'NOT_READY', reason: 'shutting down' });
    }
    return res.json({ status: 'READY', version: config.version });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', path: req.path });
  });

  app.locals.state = state;
  return app;
}

module.exports = { createApp };
