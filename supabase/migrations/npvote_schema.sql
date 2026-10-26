-- NPVote schema for Supabase (Postgres).
-- Run once in Supabase Dashboard → SQL Editor, or with `supabase db push`.

-- Event settings. A single row stores whether voting is open.
create table if not exists public.settings (
  id text primary key,
  open boolean not null default false,
  updated_at timestamptz not null default now()
);

-- One row per browser. `browser` is the primary key, so the first vote wins.
create table if not exists public.votes (
  browser uuid primary key,
  candidate smallint not null check (candidate between 1 and 12),
  created timestamptz not null default now()
);

-- Voting starts closed. The admin opens it from /admin.
insert into public.settings (id, open) values ('event', false)
on conflict (id) do nothing;

-- Row Level Security with no policies: anon/authenticated keys can read nothing.
-- Only the service role (used server-side by Next.js) bypasses RLS.
alter table public.settings enable row level security;
alter table public.votes enable row level security;

-- Minimal privileges: remove the default grants Supabase gives to public keys.
revoke all on public.settings from anon, authenticated;
revoke all on public.votes from anon, authenticated;
grant select, insert, update on public.settings to service_role;
grant select, insert, update, delete on public.votes to service_role;

-- Per-contestant tally used by the admin dashboard.
create or replace view public.vote_tally as
  select candidate, count(*)::bigint as total
  from public.votes
  group by candidate;

revoke all on public.vote_tally from anon, authenticated;
grant select on public.vote_tally to service_role;

-- Atomic vote write: checks the open flag and inserts the first vote only.
-- Returns {status: 'voted', candidate} | {status: 'closed'} | {status: 'invalid'}.
create or replace function public.cast_vote(p_browser uuid, p_candidate smallint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open boolean;
  v_stored smallint;
begin
  if p_browser is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  if p_candidate is null or p_candidate < 1 or p_candidate > 12 then
    return jsonb_build_object('status', 'invalid');
  end if;

  select open into v_open from public.settings where id = 'event';
  if v_open is not true then
    return jsonb_build_object('status', 'closed');
  end if;

  insert into public.votes (browser, candidate)
  values (p_browser, p_candidate)
  on conflict (browser) do nothing;

  select candidate into v_stored from public.votes where browser = p_browser;
  return jsonb_build_object('status', 'voted', 'candidate', v_stored);
end;
$$;

revoke all on function public.cast_vote(uuid, smallint) from public, anon, authenticated;
grant execute on function public.cast_vote(uuid, smallint) to service_role;
