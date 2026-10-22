'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const { loadConfig } = require('../src/config');
const { buildSnapshot, rolloutPhase, versionFromImage, createClusterClient, inClusterRequester } = require('../src/k8s');

const NOW = Date.parse('2026-10-22T10:00:00Z');
const ago = (s) => new Date(NOW - s * 1000).toISOString();

// A Deployment in the middle of a rolling update from v1.0.0 to v2.0.0.
const deployment = (overrides = {}) => ({
  metadata: {
    name: 'version-app', namespace: 'version-app', generation: 2,
    annotations: { 'deployment.kubernetes.io/revision': '2', 'kubernetes.io/change-cause': 'Release v2.0.0' },
  },
  spec: {
    replicas: 4, progressDeadlineSeconds: 60, minReadySeconds: 5,
    strategy: { type: 'RollingUpdate', rollingUpdate: { maxSurge: 1, maxUnavailable: 0 } },
    template: { spec: { containers: [{ image: 'version-app:2.0.0' }] } },
  },
  status: {
    observedGeneration: 2, replicas: 5, updatedReplicas: 2, readyReplicas: 5, availableReplicas: 4,
    conditions: [{ type: 'Progressing', status: 'True', reason: 'ReplicaSetUpdated' }],
  },
  ...overrides,
});

const replicaSets = {
  items: [
    { metadata: { name: 'version-app-aaa', labels: { 'pod-template-hash': 'aaa' }, creationTimestamp: ago(600),
      annotations: { 'deployment.kubernetes.io/revision': '1', 'kubernetes.io/change-cause': 'Initial release v1.0.0' } },
      spec: { replicas: 3, template: { spec: { containers: [{ image: 'version-app:1.0.0' }] } } }, status: { readyReplicas: 3 } },
    { metadata: { name: 'version-app-bbb', labels: { 'pod-template-hash': 'bbb' }, creationTimestamp: ago(20),
      annotations: { 'deployment.kubernetes.io/revision': '2', 'kubernetes.io/change-cause': 'Release v2.0.0' } },
      spec: { replicas: 2, template: { spec: { containers: [{ image: 'version-app:2.0.0' }] } } }, status: { readyReplicas: 2 } },
  ],
};

const pod = (name, image, ready, ageS, extra = {}) => ({
  metadata: { name, creationTimestamp: ago(ageS), labels: { 'pod-template-hash': 'x' }, ...extra },
  spec: { nodeName: 'node-1', containers: [{ image }] },
  status: { phase: 'Running', podIP: '10.0.0.1', containerStatuses: [{ ready, restartCount: 0 }] },
});
const pods = {
  items: [
    pod('version-app-aaa-1', 'version-app:1.0.0', true, 600),
    pod('version-app-aaa-2', 'version-app:1.0.0', true, 600, { deletionTimestamp: ago(1) }),
    pod('version-app-bbb-1', 'version-app:2.0.0', true, 20),
    pod('version-app-bbb-2', 'version-app:2.0.0', false, 3),
  ],
};

const events = {
  items: [
    { metadata: { creationTimestamp: ago(30) }, lastTimestamp: ago(30), type: 'Normal', reason: 'ScalingReplicaSet',
      involvedObject: { kind: 'Deployment', name: 'version-app' }, message: 'Scaled up replica set version-app-bbb from 1 to 2' },
    { metadata: { creationTimestamp: ago(5) }, lastTimestamp: ago(5), type: 'Warning', reason: 'Unhealthy', count: 4,
      involvedObject: { kind: 'Pod', name: 'version-app-bbb-2' }, message: 'Readiness probe failed: HTTP probe failed with statuscode: 503' },
    { metadata: { creationTimestamp: ago(2) }, lastTimestamp: ago(2), type: 'Normal', reason: 'Pulled',
      involvedObject: { kind: 'Pod', name: 'some-other-app' }, message: 'unrelated' },
  ],
};

describe('versionFromImage', () => {
  test('extracts the tag from plain and registry image names', () => {
    expect(versionFromImage('version-app:2.0.0')).toBe('2.0.0');
    expect(versionFromImage('ghcr.io/user/version-app:1.0.0')).toBe('1.0.0');
    expect(versionFromImage('localhost:5000/version-app:3.0.0@sha256:abc')).toBe('3.0.0');
  });
});

describe('rolloutPhase', () => {
  test('progressing while old pods remain', () => {
    expect(rolloutPhase(deployment())).toBe('progressing');
  });

  test('complete when every replica is updated and available', () => {
    const d = deployment();
    d.status = { ...d.status, replicas: 4, updatedReplicas: 4, readyReplicas: 4, availableReplicas: 4 };
    expect(rolloutPhase(d)).toBe('complete');
  });

  test('failed when the progress deadline is exceeded', () => {
    const d = deployment();
    d.status.conditions = [{ type: 'Progressing', status: 'False', reason: 'ProgressDeadlineExceeded' }];
    expect(rolloutPhase(d)).toBe('failed');
  });
});

describe('buildSnapshot', () => {
  const snap = buildSnapshot(deployment(), replicaSets, pods, events, 'version-app', NOW);

  test('summarises the deployment and rollout settings', () => {
    expect(snap.deployment).toMatchObject({
      revision: '2', version: '2.0.0', changeCause: 'Release v2.0.0', maxSurge: 1, maxUnavailable: 0,
      desired: 4, updated: 2, available: 4, phase: 'progressing',
    });
  });

  test('lists ReplicaSets newest revision first and marks the current one', () => {
    expect(snap.replicaSets.map((r) => [r.revision, r.version, r.current])).toEqual([
      ['2', '2.0.0', true],
      ['1', '1.0.0', false],
    ]);
  });

  test('reports per-pod version, readiness and termination', () => {
    const byName = Object.fromEntries(snap.pods.map((p) => [p.name, p]));
    expect(byName['version-app-bbb-2']).toMatchObject({ version: '2.0.0', ready: false, ageSeconds: 3 });
    expect(byName['version-app-aaa-2'].terminating).toBe(true);
    expect(snap.pods[0].ageSeconds).toBeGreaterThanOrEqual(snap.pods[snap.pods.length - 1].ageSeconds);
  });

  test('keeps only this deployment\'s events, newest first', () => {
    expect(snap.events.map((e) => e.reason)).toEqual(['Unhealthy', 'ScalingReplicaSet']);
    expect(snap.events[0]).toMatchObject({ type: 'Warning', count: 4, object: 'Pod/version-app-bbb-2' });
  });
});

describe('createClusterClient', () => {
  test('queries the four API paths and caches the result', async () => {
    const calls = [];
    const fixtures = [deployment(), replicaSets, pods, events];
    const fake = (path) => { calls.push(path); return Promise.resolve(fixtures[calls.length - 1 - 4 * Math.floor((calls.length - 1) / 4)]); };
    let t = NOW;
    const client = createClusterClient({ request: fake, namespace: 'version-app', deployment: 'version-app', ttlMs: 1000, now: () => t });
    await client.snapshot();
    await client.snapshot();
    expect(calls).toHaveLength(4);
    expect(calls[0]).toBe('/apis/apps/v1/namespaces/version-app/deployments/version-app');
    expect(calls[2]).toBe('/api/v1/namespaces/version-app/pods?labelSelector=app%3Dversion-app');
    t += 1500;
    await client.snapshot();
    expect(calls).toHaveLength(8);
  });

  test('is disabled outside a cluster', () => {
    expect(inClusterRequester({})).toBeNull();
  });
});

describe('GET /api/cluster', () => {
  const config = loadConfig({ APP_VERSION: '2.0.0', HOSTNAME: 'version-app-bbb-1' });

  test('reports unavailable when not running in Kubernetes', async () => {
    const res = await request(createApp(config)).get('/api/cluster');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: false, reason: 'Not running inside Kubernetes' });
  });

  test('returns the cluster snapshot when a client is provided', async () => {
    const cluster = { snapshot: async () => buildSnapshot(deployment(), replicaSets, pods, events, 'version-app', NOW) };
    const res = await request(createApp(config, { cluster })).get('/api/cluster');
    expect(res.body.available).toBe(true);
    expect(res.body.servedBy).toBe('version-app-bbb-1');
    expect(res.body.pods).toHaveLength(4);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  test('reports unavailable when the Kubernetes API fails', async () => {
    const cluster = { snapshot: async () => { throw new Error('Kubernetes API 403'); } };
    const res = await request(createApp(config, { cluster })).get('/api/cluster');
    expect(res.body).toEqual({ available: false, reason: 'Kubernetes API 403' });
  });
});

describe('inClusterRequester', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { EventEmitter } = require('events');
  const { readNamespace } = require('../src/k8s');

  const saDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-'));
  fs.writeFileSync(path.join(saDir, 'token'), 'secret-token\n');
  fs.writeFileSync(path.join(saDir, 'ca.crt'), 'CA');
  fs.writeFileSync(path.join(saDir, 'namespace'), 'version-app\n');
  const env = { KUBERNETES_SERVICE_HOST: '10.96.0.1', KUBERNETES_SERVICE_PORT: '443' };

  // Fake https.request: replies with the given status/body, or emits an error/timeout.
  const transport = (reply) => (opts, onResponse) => {
    const req = new EventEmitter();
    req.opts = opts;
    req.destroy = (err) => req.emit('error', err);
    req.end = () => setImmediate(() => {
      if (reply.error) return req.emit('error', reply.error);
      if (reply.timeout) return req.emit('timeout');
      const res = new EventEmitter();
      res.statusCode = reply.status;
      res.setEncoding = () => {};
      onResponse(res);
      res.emit('data', reply.body);
      res.emit('end');
    });
    transport.last = req;
    return req;
  };

  test('sends the ServiceAccount token and parses JSON', async () => {
    const t = transport({ status: 200, body: '{"kind":"Deployment"}' });
    const get = inClusterRequester(env, saDir, t);
    await expect(get('/apis/apps/v1/x')).resolves.toEqual({ kind: 'Deployment' });
    expect(transport.last.opts).toMatchObject({ host: '10.96.0.1', port: '443', path: '/apis/apps/v1/x' });
    expect(transport.last.opts.headers.Authorization).toBe('Bearer secret-token');
  });

  test('rejects on HTTP errors, bad JSON, network errors and timeouts', async () => {
    await expect(inClusterRequester(env, saDir, transport({ status: 403, body: '' }))('/p')).rejects.toThrow('403');
    await expect(inClusterRequester(env, saDir, transport({ status: 200, body: 'not json' }))('/p')).rejects.toThrow();
    await expect(inClusterRequester(env, saDir, transport({ error: new Error('ECONNREFUSED') }))('/p')).rejects.toThrow('ECONNREFUSED');
    await expect(inClusterRequester(env, saDir, transport({ timeout: true }))('/p')).rejects.toThrow('timeout');
  });

  test('defaults the port and reads the namespace file', async () => {
    const t = transport({ status: 200, body: '{}' });
    await inClusterRequester({ KUBERNETES_SERVICE_HOST: 'h' }, saDir, t)('/p');
    expect(transport.last.opts.port).toBe(443);
    expect(readNamespace(saDir)).toBe('version-app');
    expect(readNamespace('/nonexistent')).toBeNull();
  });
});

describe('buildSnapshot with sparse objects', () => {
  test('tolerates missing status, annotations, labels and strategy', () => {
    const dep = { metadata: { name: 'version-app' }, spec: { template: { spec: { containers: [{ image: 'version-app:1.0.0' }] } } } };
    const rs = { items: [{ metadata: { name: 'rs' }, spec: { template: { spec: { containers: [{ image: 'version-app:1.0.0' }] } } } }] };
    const pd = { items: [{ metadata: { name: 'p' }, spec: { containers: [{ image: 'version-app:1.0.0' }] } }] };
    const ev = { items: [{ metadata: { creationTimestamp: ago(1) }, eventTime: ago(1), type: 'Normal', reason: 'Created',
      involvedObject: { kind: 'Pod', name: 'version-app-x' }, message: 'm' }, { metadata: {}, involvedObject: {} }] };
    const snap = buildSnapshot(dep, rs, pd, ev, 'version-app', NOW);
    expect(snap.deployment).toMatchObject({ revision: null, desired: 1, updated: 0, maxSurge: null, strategy: 'RollingUpdate', phase: 'progressing' });
    expect(snap.replicaSets[0]).toMatchObject({ desired: 0, ready: 0, revision: null, changeCause: null, ageSeconds: null });
    expect(snap.pods[0]).toMatchObject({ ready: false, phase: 'Unknown', restarts: 0, node: null, ip: null, hash: null });
    expect(snap.events).toHaveLength(1);
    expect(buildSnapshot(dep, {}, {}, {}, 'version-app', NOW)).toMatchObject({ replicaSets: [], pods: [], events: [] });
  });
});
