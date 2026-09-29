import { createHmac, timingSafeEqual } from 'node:crypto';
export const LOCAL_COOKIE = 'estuda-local-session';
export const LOCAL_ACCOUNT = { id: 'local-student', email: 'local@estuda.test', mode: 'local' };
// Only the loopback launcher supplies the binding marker and signing secret.
export function localEnabled(env = process.env) {
  return env.ESTUDA_LOCAL_MODE === '1' && env.ESTUDA_LOOPBACK_BOUND === '1' &&
    !env.VERCEL && env.APP_URL === 'http://127.0.0.1:3210' &&
    (env.ESTUDA_LOCAL_SECRET?.length || 0) >= 64;
}
export function issueLocalSession() {
  if (!localEnabled()) throw new Error('Modo local indisponível.');
  const payload = String(Date.now() + 86400000);
  return `${payload}.${createHmac('sha256', process.env.ESTUDA_LOCAL_SECRET).update(payload).digest('hex')}`;
}
export function validLocalSession(token) {
  if (!localEnabled() || typeof token !== 'string') return false;
  const [expires, signature, extra] = token.split('.');
  if (extra || !/^\d+$/.test(expires) || Number(expires) <= Date.now() || !/^[a-f0-9]{64}$/.test(signature || '')) return false;
  const expected = createHmac('sha256', process.env.ESTUDA_LOCAL_SECRET).update(expires).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
export function localRequestAllowed(request) {
  return localEnabled() && request.headers.get('host') === '127.0.0.1:3210';
}
