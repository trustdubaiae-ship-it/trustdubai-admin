-- Per-admin saved chat history for the Quvera AI Manager (ChatGPT-style threads).
create table if not exists public.admin_ai_threads (
  email      text primary key,
  threads    jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);
alter table public.admin_ai_threads enable row level security;

-- An active admin reads/writes only their own thread store.
drop policy if exists aat_self on public.admin_ai_threads;
create policy aat_self on public.admin_ai_threads for all
  using (
    lower(email) = lower(coalesce(auth.email(), ''))
    and exists (select 1 from public.admin_users a where lower(a.email) = lower(auth.email()) and a.is_active = true)
  )
  with check (lower(email) = lower(coalesce(auth.email(), '')));
