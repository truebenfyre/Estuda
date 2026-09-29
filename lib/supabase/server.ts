import { LOCAL_ACCOUNT, LOCAL_COOKIE, validLocalSession } from "../local-session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function authConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
export const appUrl = () => process.env.APP_URL || "http://127.0.0.1:3210";
export async function supabaseServer() {
  if (!authConfigured()) throw new Error("Supabase ainda não configurado.");
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        secure: appUrl().startsWith("https://"),
        path: "/",
      },
      cookies: {
        getAll: () => store.getAll(),
        setAll(values) {
          try {
            values.forEach(({ name, value, options }) =>
              store.set(name, value, options),
            );
          } catch {
            /* Read-only Server Components rely on proxy refresh. */
          }
        },
      },
    },
  );
}
export async function currentAccount() {
  if (validLocalSession((await cookies()).get(LOCAL_COOKIE)?.value)) return LOCAL_ACCOUNT;
  if (!authConfigured()) return null;
  try {
    const client = await supabaseServer();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    return error || !user ? null : { id: user.id, email: user.email || "" };
  } catch {
    return null;
  }
}
