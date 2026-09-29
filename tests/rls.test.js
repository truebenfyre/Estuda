import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("migration is idempotent and PostgreSQL RLS isolates two users and anonymous access", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`,
    );
    const migration = await readFile(
      new URL(
        "../supabase/migrations/202609260001_student_states.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration);
    const alice = "00000000-0000-0000-0000-000000000001",
      bob = "00000000-0000-0000-0000-000000000002";
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${alice}',false);`,
    );
    await db.query(
      "insert into public.student_states(user_id,state) values ($1,$2)",
      [alice, { version: 1 }],
    );
    assert.equal(
      (await db.query("select * from public.student_states")).rows.length,
      1,
    );
    await assert.rejects(
      db.query(
        "insert into public.student_states(user_id,state) values ($1,$2)",
        [bob, { version: 1 }],
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.query("update public.student_states set user_id=$1", [bob]),
      /row-level security/,
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${bob}',false);`);
    assert.equal(
      (await db.query("select * from public.student_states")).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "update public.student_states set revision=2 returning user_id",
        )
      ).rows.length,
      0,
    );
    await db.query(
      "insert into public.student_states(user_id,state) values ($1,$2)",
      [bob, { version: 1 }],
    );
    assert.equal(
      (await db.query("select user_id from public.student_states")).rows[0]
        .user_id,
      bob,
    );
    await db.exec("reset role;set role anon;");
    await assert.rejects(
      db.query("select * from public.student_states"),
      /permission denied/,
    );
    await assert.rejects(
      db.query(
        "insert into public.student_states(user_id,state) values ($1,$2)",
        [alice, { version: 1 }],
      ),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
