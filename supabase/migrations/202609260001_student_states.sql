-- One document per verified Supabase user; local data is never imported automatically.
create table if not exists public.student_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object' and state->>'version' is not null and state->>'version' = '1'),
  revision bigint not null default 1 check (revision > 0)
);
alter table public.student_states enable row level security;
alter table public.student_states force row level security;
revoke all on table public.student_states from anon;
revoke all on table public.student_states from authenticated;
grant select, insert, update on table public.student_states to authenticated;
drop policy if exists student_read_own on public.student_states;
create policy student_read_own on public.student_states for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists student_insert_own on public.student_states;
create policy student_insert_own on public.student_states for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists student_update_own on public.student_states;
create policy student_update_own on public.student_states for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
