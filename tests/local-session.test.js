import test from 'node:test';
import assert from 'node:assert/strict';
import { localEnabled, issueLocalSession, validLocalSession } from '../lib/local-session.js';
test('local entry requires explicit loopback launcher and refuses Vercel; session is signed and expiring', () => {
  const enabled = { ESTUDA_LOCAL_MODE: '1', ESTUDA_LOOPBACK_BOUND: '1', APP_URL: 'http://127.0.0.1:3210', ESTUDA_LOCAL_SECRET: 's'.repeat(96) };
  assert.equal(localEnabled(enabled), true);
  for (const override of [{ ESTUDA_LOCAL_MODE: '0' }, { ESTUDA_LOOPBACK_BOUND: '' }, { VERCEL: '1' }, { APP_URL: 'https://example.com' }, { ESTUDA_LOCAL_SECRET: '' }]) {
    assert.equal(localEnabled({ ...enabled, ...override }), false);
  }
  const previous = { ...process.env };
  try {
    Object.assign(process.env, enabled);
    delete process.env.VERCEL;
    const token = issueLocalSession();
    assert.equal(validLocalSession(token), true);
    assert.equal(validLocalSession(token + 'x'), false);
    assert.equal(validLocalSession('0.' + token.split('.')[1]), false);
    process.env.VERCEL = '1';
    assert.equal(validLocalSession(token), false);
    assert.throws(issueLocalSession);
    delete process.env.VERCEL;
    process.env.ESTUDA_LOCAL_MODE = '0';
    assert.equal(validLocalSession(token), false);
  } finally {
    for (const key of [...Object.keys(enabled), 'VERCEL']) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
