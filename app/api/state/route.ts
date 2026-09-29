import { NextRequest, NextResponse } from "next/server";
import {
  supabaseServer,
  authConfigured,
  appUrl,
} from "../../../lib/supabase/server";
import {
  initialState,
  deserialize,
  transition,
  serialize,
  isPristine,
} from "../../../lib/model";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
async function context() {
  if (!authConfigured())
    return {
      failure: reply({ error: "Supabase ainda não configurado." }, 503),
    };
  const client = await supabaseServer();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    return {
      failure: reply({ error: "Entre novamente para continuar." }, 401),
    };
  return { client, user };
}
export async function GET() {
  try {
    const c = await context();
    if (c.failure) return c.failure;
    const { data, error } = await c
      .client!.from("student_states")
      .select("state,revision")
      .eq("user_id", c.user!.id)
      .maybeSingle();
    if (error)
      return reply(
        {
          error:
            "Não foi possível carregar seus dados. Verifique a conexão e a migração do banco.",
        },
        503,
      );
    return reply({
      state: data ? deserialize(JSON.stringify(data.state)) : initialState(),
      revision: data?.revision || 0,
      userId: c.user!.id,
    });
  } catch {
    return reply(
      { error: "Não foi possível ler seus dados. Nada foi substituído." },
      503,
    );
  }
}
export async function POST(request: NextRequest) {
  // Cookie-authenticated writes accept requests from this origin only.
  const origin = request.headers.get("origin");
  if (!origin || origin !== appUrl())
    return reply({ error: "Origem não permitida." }, 403);
  try {
    const c = await context();
    if (c.failure) return c.failure;
    const raw = await request.text();
    if (raw.length > 1000000)
      return reply({ error: "Dados grandes demais." }, 413);
    const body = JSON.parse(raw);
    if (!Number.isSafeInteger(body.revision) || body.revision < 0)
      return reply({ error: "Revisão inválida." }, 400);
    const { data, error } = await c
      .client!.from("student_states")
      .select("state,revision")
      .eq("user_id", c.user!.id)
      .maybeSingle();
    if (error)
      return reply(
        { error: "O banco não está disponível. A alteração não foi salva." },
        503,
      );
    const revision = data?.revision || 0;
    if (revision !== body.revision)
      return reply(
        {
          error:
            "Os dados mudaram em outra aba ou dispositivo. Atualize e tente novamente.",
        },
        409,
      );
    const previous = data
      ? deserialize(JSON.stringify(data.state))
      : initialState();
    let next;
    if (body.importState) {
      if (!isPristine(previous))
        return reply(
          {
            error:
              "A conta já possui dados. A importação não pode sobrescrevê-los.",
          },
          409,
        );
      if (!c.user!.email || body.confirmEmail !== c.user!.email)
        return reply(
          { error: "Confirme o email da conta que receberá os dados." },
          400,
        );
      next = deserialize(JSON.stringify(body.importState));
    } else {
      if (!body.action || typeof body.action.type !== "string")
        return reply({ error: "Ação inválida." }, 400);
      next = transition(previous, body.action, Date.now());
      deserialize(serialize(next));
    }
    const write = data
      ? c
          .client!.from("student_states")
          .update({ state: next, revision: revision + 1 })
          .eq("user_id", c.user!.id)
          .eq("revision", revision)
          .select("revision")
          .maybeSingle()
      : c
          .client!.from("student_states")
          .insert({ user_id: c.user!.id, state: next, revision: 1 })
          .select("revision")
          .single();
    const result = await write;
    if (result.error?.code === "23505" || (!result.error && !result.data))
      return reply(
        {
          error:
            "Outra atualização chegou primeiro. Recarregue os dados antes de continuar.",
        },
        409,
      );
    if (result.error)
      return reply(
        {
          error:
            "Não foi possível salvar. Seus dados anteriores foram preservados.",
        },
        503,
      );
    return reply({ state: next, revision: revision + 1, userId: c.user!.id });
  } catch (e) {
    return reply(
      { error: e instanceof Error ? e.message : "Dados inválidos." },
      400,
    );
  }
}
