const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-not-for-production';
process.env.NODE_ENV = 'test';
process.env.CLIENT_ORIGIN = 'https://app.example.test';

// The route modules open Redis connections on import; stub them so the suite needs no Redis or Mongo.
const stub = (path, exports) => {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports };
};
stub('../src/queues/aiQueue', { aiQueue: { add: async () => ({}) } });
stub('../src/socket/publish', { publishEvent: async () => {} });

const app = require('../src/app');
const { requireRole, scopeLeadsQuery } = require('../src/middleware/rbac');
const { isOriginAllowed } = require('../src/config/origins');
const ai = require('../src/services/ai');

let server;
let base;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const token = (claims) => jwt.sign(claims, process.env.JWT_SECRET, { expiresIn: '5m' });

test('health endpoint reports mock AI mode without an OpenAI key', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, aiMode: 'mock' });
});

test('login rejects missing or non-string credentials before touching the database', async () => {
  for (const body of [{}, { email: 'a@b.co' }, { email: { $ne: null }, password: { $ne: null } }]) {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal(res.status, 400);
  }
});

test('protected routes require a valid bearer token', async () => {
  for (const path of ['/api/leads', '/api/users', '/api/dashboard']) {
    const missing = await fetch(`${base}${path}`);
    assert.equal(missing.status, 401);
    const bad = await fetch(`${base}${path}`, { headers: { Authorization: 'Bearer nope' } });
    assert.equal(bad.status, 401);
  }
});

test('a token signed with a different secret is rejected', async () => {
  const forged = jwt.sign({ sub: 'x', role: 'admin' }, 'some-other-secret');
  const res = await fetch(`${base}/api/leads`, { headers: { Authorization: `Bearer ${forged}` } });
  assert.equal(res.status, 401);
});

test('requireRole blocks sales reps from admin-only actions', () => {
  const run = (role) => {
    let status = null;
    let nexted = false;
    const res = { status(code) { status = code; return this; }, json() {} };
    requireRole('admin')({ user: { role } }, res, () => { nexted = true; });
    return { status, nexted };
  };
  assert.deepEqual(run('sales-rep'), { status: 403, nexted: false });
  assert.deepEqual(run('admin'), { status: null, nexted: true });
});

test('lead scoping: admins see everything, reps see only their own and unassigned leads', () => {
  assert.deepEqual(scopeLeadsQuery({ user: { role: 'admin', sub: 'u1' } }), {});
  assert.deepEqual(scopeLeadsQuery({ user: { role: 'sales-rep', sub: 'u1' } }), {
    $or: [{ assignedTo: 'u1' }, { assignedTo: null }],
  });
});

test('CORS allowlist accepts configured origins and rejects others', () => {
  assert.equal(isOriginAllowed('https://app.example.test'), true);
  assert.equal(isOriginAllowed('https://evil.example.test'), false);
  assert.equal(isOriginAllowed('http://localhost:5173'), true); // dev only: NODE_ENV !== production
});

test('mock sentiment matches whole words only', async () => {
  const good = await ai.analyzeSentiment('Great call, very happy with the proposal');
  assert.equal(good.label, 'positive');
  const neutral = await ai.analyzeSentiment('I know you took a note now');
  assert.equal(neutral.label, 'neutral');
});
