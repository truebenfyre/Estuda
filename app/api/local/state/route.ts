import { NextRequest, NextResponse } from 'next/server';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { LOCAL_ACCOUNT, LOCAL_COOKIE, localRequestAllowed, validLocalSession } from '../../../../lib/local-session';
import { initialState, deserialize, serialize, transition, isPristine } from '../../../../lib/model';
export const dynamic = 'force-dynamic';
const file = `${process.cwd()}/.local/student-state.json`;
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
function permitted(request: NextRequest) {
  return localRequestAllowed(request) && validLocalSession(request.cookies.get(LOCAL_COOKIE)?.value);
}
async function snapshot() {
  try {
    const saved = JSON.parse(await readFile(file, 'utf8'));
    return { state: deserialize(JSON.stringify(saved.state)), revision: saved.revision, userId: LOCAL_ACCOUNT.id };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Dados locais ilegíveis. O arquivo foi preservado.');
    return { state: initialState(), revision: 0, userId: LOCAL_ACCOUNT.id };
  }
}
export async function GET(request: NextRequest) {
  if (!permitted(request)) return reply({ error: 'Entre no modo local para continuar.' }, 401);
  try { return reply(await snapshot()); }
  catch (e) { return reply({ error: (e as Error).message }, 503); }
}
// One loopback server, with serialized writes and atomic replacement.
let pending = Promise.resolve();
export async function POST(request: NextRequest) {
  if (!permitted(request) || request.headers.get('origin') !== process.env.APP_URL)
    return reply({ error: 'Acesso local não permitido.' }, 403);
  const raw = await request.text();
  if (raw.length > 1000000) return reply({ error: 'Dados grandes demais.' }, 413);
  const operation = pending.then(async () => {
    try {
      const body = JSON.parse(raw);
      const before = await snapshot();
      if (body.revision !== before.revision) return reply({ error: 'Os dados mudaram em outra aba. Tente novamente.' }, 409);
      let state;
      if (body.importState) {
        if (!isPristine(before.state)) return reply({ error: 'O modo local já possui dados. Nada foi substituído.' }, 409);
        if (body.confirmEmail !== LOCAL_ACCOUNT.email) return reply({ error: 'Confirme o destino local@estuda.test.' }, 400);
        state = deserialize(JSON.stringify(body.importState));
      } else {
        state = transition(before.state, body.action, Date.now());
        deserialize(serialize(state));
      }
      const after = { state, revision: before.revision + 1, userId: LOCAL_ACCOUNT.id };
      await mkdir(`${process.cwd()}/.local`, { recursive: true, mode: 0o700 });
      await writeFile(`${file}.tmp`, JSON.stringify(after), { mode: 0o600 });
      await rename(`${file}.tmp`, file);
      return reply(after);
    } catch (e) { return reply({ error: (e as Error).message }, 400); }
  });
  pending = operation.then(() => {}, () => {});
  return operation;
}
