import { NextRequest, NextResponse } from 'next/server';
import { LOCAL_COOKIE, issueLocalSession, localRequestAllowed } from '../../../../lib/local-session';
function change(request: NextRequest, entering: boolean) {
  if (!localRequestAllowed(request) || request.headers.get('origin') !== process.env.APP_URL)
    return NextResponse.json({ error: 'Modo local indisponível.' }, { status: 403 });
  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(LOCAL_COOKIE, entering ? issueLocalSession() : '', {
    httpOnly: true, sameSite: 'strict', path: '/', secure: false, maxAge: entering ? 86400 : 0,
  });
  return response;
}
export const POST = (request: NextRequest) => change(request, true);
export const DELETE = (request: NextRequest) => change(request, false);
