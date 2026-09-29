"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import StudyApp from "./study-app";
import { PATHS } from "../lib/routes";
import * as auth from "../app/auth/actions";
import { cloud, local } from "../lib/cloud";

export default function RouterApp({ children, account, configured, localAvailable }) {
  const pathname = usePathname();
  const router = useRouter();
  if (
    !Object.values(PATHS).includes(pathname) &&
    pathname !== "/" &&
    pathname !== "/login" &&
    pathname !== "/recuperar-senha"
  )
    return children;
  return (
    <StudyApp
      key={account?.id || "signed-out"}
      account={account}
      configured={configured}
      localAvailable={localAvailable}
      auth={{ ...auth,
        enterLocal: async () => (await fetch('/api/local/session', { method: 'POST' })).json(),
        signOut: account?.mode === 'local'
          ? async () => (await fetch('/api/local/session', { method: 'DELETE' })).json()
          : auth.signOut,
      }}
      transport={account?.mode === "local" ? local : cloud}
      pathname={pathname}
      navigate={(path, replace = false, refresh = false) => {
        router[replace ? "replace" : "push"](path, { scroll: false });
        if (refresh) router.refresh();
      }}
      LinkComponent={Link}
    />
  );
}
