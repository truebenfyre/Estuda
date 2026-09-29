import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import next from 'next';
if (process.env.VERCEL) {
  throw new Error('O modo local não pode executar na Vercel.');
}
const dev = process.argv.includes('--dev');
process.env.ESTUDA_LOCAL_MODE = '1';
process.env.APP_URL = 'http://127.0.0.1:3210';
await mkdir('.local', { recursive: true, mode: 0o700 });
try { process.env.ESTUDA_LOCAL_SECRET = await readFile('.local/session-secret', 'utf8'); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  process.env.ESTUDA_LOCAL_SECRET = randomBytes(48).toString('hex');
  await writeFile('.local/session-secret', process.env.ESTUDA_LOCAL_SECRET, { mode: 0o600, flag: 'wx' });
}
let handler;
const server = http.createServer((req, res) => {
  // Check the actual TCP peer before Next.js. Headers cannot grant local access.
  const loopback = ['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  if (!loopback || req.headers.host !== '127.0.0.1:3210' ||
      req.headers.forwarded || req.headers['x-forwarded-for'] || req.headers['x-forwarded-host'] ||
      (req.headers.origin && req.headers.origin !== process.env.APP_URL)) {
    res.writeHead(403); res.end('Local access only'); return;
  }
  if (!handler) { res.writeHead(503); res.end('Starting'); return; }
  handler(req, res);
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(3210, '127.0.0.1', resolve); });
process.env.ESTUDA_LOOPBACK_BOUND = '1';
const app = next({ dev, hostname: '127.0.0.1', port: 3210 });
await app.prepare();
handler = app.getRequestHandler();
console.log(`Estuda local (${dev ? 'development' : 'production'}) ready at http://127.0.0.1:3210`);
