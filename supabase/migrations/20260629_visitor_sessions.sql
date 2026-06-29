-- Visitor-session tracking for Platform Analytics.
-- The public site (quvera.ae) already calls fn_track_session on every page load,
-- navigation and a 20s heartbeat — but the table + RPC were never created, so the
-- calls failed silently and the admin Analytics session tiles (Avg time, Pages/
-- visit, Bounce, Returning %, Activity heatmap) stayed empty. This creates them.

create table if not exists public.visitor_sessions (
  id           uuid primary key default gen_random_uuid(),
  session_key  text unique not null,
  visitor_ip   text,
  country      text,
  user_agent   text,
  page_count   int  not null default 1,
  duration_sec int  not null default 0,
  started_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists visitor_sessions_started_idx on public.visitor_sessions (started_at desc);

alter table public.visitor_sessions enable row level security;

-- Active admins read sessions (for the dashboard). No direct writes from clients —
-- the public site writes only through the SECURITY DEFINER RPC below.
drop policy if exists vs_admin_read on public.visitor_sessions;
create policy vs_admin_read on public.visitor_sessions for select
  using (exists (
    select 1 from public.admin_users a
    where lower(a.email) = lower(auth.email()) and a.is_active = true
  ));

-- Upsert a session: first call inserts; later calls extend duration_sec and count
-- pages. IP/country backfill only when previously unknown (coalesce keeps the first
-- non-null value). Bounce = sessions whose page_count stays at 1.
create or replace function public.fn_track_session(
  p_session_key text,
  p_ip          text,
  p_country     text,
  p_user_agent  text,
  p_page        text,
  p_is_new_page boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_session_key is null or length(p_session_key) = 0 then
    return;
  end if;

  insert into public.visitor_sessions as v
    (session_key, visitor_ip, country, user_agent, page_count, duration_sec, started_at, last_seen_at)
  values
    (p_session_key, nullif(p_ip, ''), nullif(p_country, ''), nullif(p_user_agent, ''), 1, 0, now(), now())
  on conflict (session_key) do update set
    page_count   = v.page_count + (case when p_is_new_page then 1 else 0 end),
    duration_sec = greatest(0, floor(extract(epoch from (now() - v.started_at)))::int),
    last_seen_at = now(),
    visitor_ip   = coalesce(v.visitor_ip, nullif(p_ip, '')),
    country      = coalesce(v.country, nullif(p_country, '')),
    user_agent   = coalesce(v.user_agent, nullif(p_user_agent, ''));
end;
$$;

-- The public site calls this anonymously.
grant execute on function public.fn_track_session(text, text, text, text, text, boolean) to anon, authenticated;
