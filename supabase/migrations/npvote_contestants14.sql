-- NPVote: grow the contestant list from 12 to 14.
-- Run once in Supabase Dashboard → SQL Editor, only if the database was created
-- with the earlier 12-contestant version of the migrations.
-- A fresh install does not need this file: npvote_schema.sql and
-- npvote_contestants.sql already allow 14.
-- Existing votes, names and photos are kept.

-- votes.candidate accepts 13 and 14.
alter table public.votes drop constraint if exists votes_candidate_check;
alter table public.votes add constraint votes_candidate_check check (candidate between 1 and 14);

-- contestants.id accepts 13 and 14.
alter table public.contestants drop constraint if exists contestants_id_check;
alter table public.contestants add constraint contestants_id_check check (id between 1 and 14);

-- The two new rows. Rename them and add photos from /admin.
insert into public.contestants (id, name)
select g, 'Peserta ' || lpad(g::text, 2, '0')
from generate_series(13, 14) as g
on conflict (id) do nothing;

-- cast_vote(): unchanged except for the widened range.
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

  if p_candidate is null or p_candidate < 1 or p_candidate > 14 then
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
