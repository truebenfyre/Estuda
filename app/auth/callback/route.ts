import { NextRequest, NextResponse } from "next/server";
import {
  supabaseServer,
  authConfigured,
  appUrl,
} from "../../../lib/supabase/server";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code && authConfigured()) {
    try {
      const client = await supabaseServer();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) {
        const target =
          request.nextUrl.searchParams.get("next") === "/recuperar-senha"
            ? "/recuperar-senha"
            : "/meu-dia";
        return NextResponse.redirect(new URL(target, appUrl()));
      }
    } catch {
      /* Only a generic error is sent to the browser; never log auth codes. */
    }
  }
  return NextResponse.redirect(new URL("/login?error=confirmation", appUrl()));
}
