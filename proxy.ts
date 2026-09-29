import { LOCAL_COOKIE, validLocalSession } from "./lib/local-session";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
const privatePaths = [
  "/meu-dia",
  "/missoes",
  "/materias",
  "/recompensas",
  "/conquistas",
  "/recuperar-senha",
];
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  let authenticated = validLocalSession(request.cookies.get(LOCAL_COOKIE)?.value);
  if (
    !authenticated && process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    const client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookieOptions: {
          httpOnly: true,
          sameSite: "lax",
          secure: (process.env.APP_URL || "").startsWith("https://"),
          path: "/",
        },
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll(values) {
            values.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({ request });
            response.headers.set("Cache-Control", "private, no-store");
            values.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );
    try {
      const {
        data: { user },
        error,
      } = await client.auth.getUser();
      authenticated = !error && !!user;
    } catch {
      authenticated = false;
    }
  }
  if (privatePaths.includes(request.nextUrl.pathname) && !authenticated) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.search = "";
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }
  return response;
}
export const config = {
  matcher: [
    "/",
    "/login",
    "/meu-dia",
    "/missoes",
    "/materias",
    "/recompensas",
    "/conquistas",
    "/recuperar-senha",
  ],
};
