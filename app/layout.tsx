import { localEnabled } from "../lib/local-session";
import type { Metadata } from "next";
import "./globals.css";
import RouterApp from "../components/router-app";
import { currentAccount, authConfigured } from "../lib/supabase/server";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Estuda · Seu esforço vira progresso",
  description:
    "Seu espaço pessoal para organizar estudos e acompanhar pequenas conquistas.",
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await currentAccount();
  return (
    <html lang="pt-BR">
      <body>
        <RouterApp account={account} configured={authConfigured()} localAvailable={localEnabled()}>
          {children}
        </RouterApp>
      </body>
    </html>
  );
}
