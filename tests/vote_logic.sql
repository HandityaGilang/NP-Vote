-- NPVote vote-logic test. Run AFTER supabase/migrations/npvote_schema.sql,
-- in the Supabase SQL Editor or with: psql "$DATABASE_URL" -f tests/vote_logic.sql
-- Everything runs inside a transaction that is rolled back, so no real votes are kept.

begin;

do $$
declare
  r jsonb;
  n integer;
  a uuid := '00000000-0000-0000-0000-000000000001';
  b uuid := '00000000-0000-0000-0000-000000000002';
  c uuid := '00000000-0000-0000-0000-000000000003';
begin
  delete from public.votes where browser in (a, b, c);

  -- 1. Voting closed: every vote is rejected.
  update public.settings set open = false where id = 'event';
  r := public.cast_vote(a, 1);
  if r->>'status' <> 'closed' then
    raise exception 'FAIL closed voting must reject, got %', r;
  end if;

  -- 2. Voting open: first vote is stored.
  update public.settings set open = true where id = 'event';
  r := public.cast_vote(a, 1);
  if r->>'status' <> 'voted' or (r->>'candidate')::int <> 1 then
    raise exception 'FAIL first vote must be stored, got %', r;
  end if;

  -- 3. Duplicate vote from the same browser: original choice is preserved.
  r := public.cast_vote(a, 2);
  if r->>'status' <> 'voted' or (r->>'candidate')::int <> 1 then
    raise exception 'FAIL duplicate must keep the first vote, got %', r;
  end if;

  -- 4. A different browser can vote.
  r := public.cast_vote(b, 12);
  if r->>'status' <> 'voted' or (r->>'candidate')::int <> 12 then
    raise exception 'FAIL second browser must vote, got %', r;
  end if;

  -- 5. Closing voting stops new browsers.
  update public.settings set open = false where id = 'event';
  r := public.cast_vote(c, 3);
  if r->>'status' <> 'closed' then
    raise exception 'FAIL closed voting must reject new browser, got %', r;
  end if;

  -- 6. Out-of-range contestant is rejected.
  update public.settings set open = true where id = 'event';
  r := public.cast_vote(c, 99);
  if r->>'status' <> 'invalid' then
    raise exception 'FAIL out-of-range contestant must be invalid, got %', r;
  end if;

  -- 7. Exactly two votes are stored.
  select count(*) into n from public.votes where browser in (a, b, c);
  if n <> 2 then
    raise exception 'FAIL expected 2 stored votes, got %', n;
  end if;

  raise notice 'PASS: closed-by-default, first-vote-wins, duplicate preserved, closed voting, validation';
end $$;

rollback;
