'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const { loadConfig, colorFor } = require('../src/config');

const baseConfig = (overrides = {}) =>
  loadConfig({ APP_VERSION: '1.0.0', HOSTNAME: 'test-pod', GIT_COMMIT: 'abc1234', ...overrides });

describe('config', () => {
  test('uses APP_VERSION from the environment', () => {
    expect(baseConfig().version).toBe('1.0.0');
  });

  test('falls back to package.json version', () => {
    expect(loadConfig({}).version).toBe(require('../package.json').version);
  });

  test('assigns a distinct colour per major version', () => {
    expect(colorFor('1.2.3')).not.toBe(colorFor('2.0.0'));
    expect(colorFor('99.0.0')).toBe('#ea580c');
  });

  test('APP_COLOR overrides the default colour', () => {
    expect(baseConfig({ APP_COLOR: '#000000' }).color).toBe('#000000');
  });
});

describe('HTTP endpoints', () => {
  const app = createApp(baseConfig());

  test('GET /health returns UP', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'UP', version: '1.0.0' });
  });

  test('GET /ready returns READY for a healthy build', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('READY');
  });

  test('GET /api/version returns version metadata', async () => {
    const res = await request(app).get('/api/version');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      app: 'version-app',
      version: '1.0.0',
      pod: 'test-pod',
      commit: 'abc1234',
    });
  });

  test('responses carry version and pod headers', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-app-version']).toBe('1.0.0');
    expect(res.headers['x-pod-name']).toBe('test-pod');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('GET / renders the version page', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('v1.0.0');
    expect(res.text).toContain('test-pod');
  });

  test('unknown routes return 404', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('failure simulation and shutdown', () => {
  test('a broken build fails readiness but stays alive', async () => {
    const app = createApp(baseConfig({ SIMULATE_FAILURE: 'true' }));
    expect((await request(app).get('/ready')).status).toBe(503);
    expect((await request(app).get('/health')).status).toBe(200);
  });

  test('readiness fails while shutting down', async () => {
    const app = createApp(baseConfig());
    app.locals.state.shuttingDown = true;
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.reason).toBe('shutting down');
  });

  test('page output escapes HTML', async () => {
    const app = createApp(baseConfig({ HOSTNAME: '<script>x</script>' }));
    const res = await request(app).get('/');
    expect(res.text).not.toContain('<script>x</script>');
    expect(res.text).toContain('&lt;script&gt;');
  });
});
