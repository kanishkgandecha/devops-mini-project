'use strict';

const os = require('os');
const pkg = require('../package.json');

// Default colour per major version so every release is visually distinct
// while a rolling update is in progress.
const VERSION_COLORS = {
  1: '#2563eb', // blue
  2: '#16a34a', // green
  3: '#dc2626', // red
  4: '#9333ea', // purple
};

function colorFor(version) {
  const major = parseInt(String(version).split('.')[0], 10);
  return VERSION_COLORS[major] || '#ea580c';
}

function loadConfig(env = process.env) {
  const version = env.APP_VERSION || pkg.version;
  return {
    port: parseInt(env.PORT || '3000', 10),
    version,
    color: env.APP_COLOR || colorFor(version),
    commit: env.GIT_COMMIT || 'local',
    buildDate: env.BUILD_DATE || 'unknown',
    // A "broken" build is used to demonstrate a failed rollout + rollback:
    // the pod starts but never reports ready.
    broken: env.SIMULATE_FAILURE === 'true',
    hostname: env.HOSTNAME || os.hostname(),
    // Pod details injected by the Kubernetes Downward API (absent locally).
    nodeName: env.NODE_NAME || null,
    podIP: env.POD_IP || null,
    namespace: env.POD_NAMESPACE || null,
    deploymentName: env.DEPLOYMENT_NAME || 'version-app',
  };
}

module.exports = { loadConfig, colorFor, VERSION_COLORS };
