'use strict';

const fs = require('fs');
const https = require('https');

const SA_DIR = '/var/run/secrets/kubernetes.io/serviceaccount';

// Returns a function that GETs a Kubernetes API path using the pod's
// ServiceAccount, or null when not running inside a cluster.
function inClusterRequester(env = process.env, saDir = SA_DIR, transport = https.request) {
  const host = env.KUBERNETES_SERVICE_HOST;
  if (!host || !fs.existsSync(`${saDir}/token`)) return null;
  const port = env.KUBERNETES_SERVICE_PORT || 443;
  const ca = fs.readFileSync(`${saDir}/ca.crt`);

  return (path) =>
    new Promise((resolve, reject) => {
      // Re-read the token on every call: projected tokens are rotated.
      const token = fs.readFileSync(`${saDir}/token`, 'utf8').trim();
      const req = transport(
        { host, port, path, ca, timeout: 3000, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            if (res.statusCode >= 400) return reject(new Error(`Kubernetes API ${res.statusCode} for ${path}`));
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              reject(err);
            }
          });
        }
      );
      req.on('timeout', () => req.destroy(new Error(`Kubernetes API timeout for ${path}`)));
      req.on('error', reject);
      req.end();
    });
}

function readNamespace(saDir = SA_DIR) {
  try {
    return fs.readFileSync(`${saDir}/namespace`, 'utf8').trim();
  } catch {
    return null;
  }
}

const versionFromImage = (image) => String(image || '').split('@')[0].split(':').pop();
const toSeconds = (from, now) => (from ? Math.max(0, Math.round((now - Date.parse(from)) / 1000)) : null);

function rolloutPhase(dep) {
  const desired = dep.spec.replicas ?? 1;
  const st = dep.status || {};
  const progressing = (st.conditions || []).find((c) => c.type === 'Progressing');
  if (progressing && progressing.reason === 'ProgressDeadlineExceeded') return 'failed';
  const settled =
    (st.observedGeneration ?? 0) >= (dep.metadata.generation ?? 0) &&
    (st.updatedReplicas ?? 0) === desired &&
    (st.replicas ?? 0) === desired &&
    (st.availableReplicas ?? 0) === desired;
  return settled ? 'complete' : 'progressing';
}

function buildSnapshot(dep, rsList, podList, eventList, deploymentName, now = Date.now()) {
  const annotations = dep.metadata.annotations || {};
  const revision = annotations['deployment.kubernetes.io/revision'] || null;
  const container = dep.spec.template.spec.containers[0];
  const ru = (dep.spec.strategy && dep.spec.strategy.rollingUpdate) || {};
  const st = dep.status || {};

  const replicaSets = (rsList.items || [])
    .map((rs) => {
      const a = rs.metadata.annotations || {};
      const image = rs.spec.template.spec.containers[0].image;
      return {
        name: rs.metadata.name,
        hash: (rs.metadata.labels || {})['pod-template-hash'] || null,
        revision: a['deployment.kubernetes.io/revision'] || null,
        image,
        version: versionFromImage(image),
        changeCause: a['kubernetes.io/change-cause'] || null,
        desired: rs.spec.replicas ?? 0,
        ready: (rs.status && rs.status.readyReplicas) || 0,
        current: a['deployment.kubernetes.io/revision'] === revision,
        ageSeconds: toSeconds(rs.metadata.creationTimestamp, now),
      };
    })
    .sort((a, b) => Number(b.revision) - Number(a.revision));

  const pods = (podList.items || [])
    .map((p) => {
      const cs = ((p.status && p.status.containerStatuses) || [])[0] || {};
      const image = p.spec.containers[0].image;
      return {
        name: p.metadata.name,
        version: versionFromImage(image),
        ready: Boolean(cs.ready),
        phase: (p.status && p.status.phase) || 'Unknown',
        terminating: Boolean(p.metadata.deletionTimestamp),
        restarts: cs.restartCount || 0,
        ageSeconds: toSeconds(p.metadata.creationTimestamp, now),
        node: p.spec.nodeName || null,
        ip: (p.status && p.status.podIP) || null,
        hash: (p.metadata.labels || {})['pod-template-hash'] || null,
      };
    })
    .sort((a, b) => (b.ageSeconds ?? 0) - (a.ageSeconds ?? 0));

  const events = (eventList.items || [])
    .filter((e) => String((e.involvedObject || {}).name || '').startsWith(deploymentName))
    .map((e) => ({
      time: e.lastTimestamp || e.eventTime || e.metadata.creationTimestamp,
      type: e.type,
      reason: e.reason,
      object: `${e.involvedObject.kind}/${e.involvedObject.name}`,
      message: e.message,
      count: e.count || 1,
    }))
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
    .slice(0, 15);

  return {
    deployment: {
      name: dep.metadata.name,
      namespace: dep.metadata.namespace,
      revision,
      changeCause: annotations['kubernetes.io/change-cause'] || null,
      image: container.image,
      version: versionFromImage(container.image),
      strategy: (dep.spec.strategy && dep.spec.strategy.type) || 'RollingUpdate',
      maxSurge: ru.maxSurge ?? null,
      maxUnavailable: ru.maxUnavailable ?? null,
      progressDeadlineSeconds: dep.spec.progressDeadlineSeconds ?? null,
      minReadySeconds: dep.spec.minReadySeconds ?? 0,
      desired: dep.spec.replicas ?? 1,
      current: st.replicas || 0,
      updated: st.updatedReplicas || 0,
      ready: st.readyReplicas || 0,
      available: st.availableReplicas || 0,
      unavailable: st.unavailableReplicas || 0,
      phase: rolloutPhase(dep),
      conditions: (st.conditions || []).map((c) => ({ type: c.type, status: c.status, reason: c.reason, message: c.message })),
    },
    replicaSets,
    pods,
    events,
  };
}

// Reads the Deployment, its ReplicaSets, pods and recent events. Results are
// cached briefly so that many browser polls do not flood the API server.
function createClusterClient({ request, namespace, deployment, ttlMs = 1000, now = Date.now }) {
  let cache = null;
  const sel = encodeURIComponent(`app=${deployment}`);
  return {
    async snapshot() {
      if (cache && now() - cache.at < ttlMs) return cache.data;
      const [dep, rsList, podList, eventList] = await Promise.all([
        request(`/apis/apps/v1/namespaces/${namespace}/deployments/${deployment}`),
        request(`/apis/apps/v1/namespaces/${namespace}/replicasets?labelSelector=${sel}`),
        request(`/api/v1/namespaces/${namespace}/pods?labelSelector=${sel}`),
        request(`/api/v1/namespaces/${namespace}/events`),
      ]);
      const data = buildSnapshot(dep, rsList, podList, eventList, deployment, now());
      cache = { at: now(), data };
      return data;
    },
  };
}

module.exports = { inClusterRequester, readNamespace, createClusterClient, buildSnapshot, rolloutPhase, versionFromImage };
