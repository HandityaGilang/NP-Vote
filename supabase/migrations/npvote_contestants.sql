-- NPVote: contestants table + photo storage.
-- Run once in Supabase Dashboard → SQL Editor, after npvote_schema.sql.

-- Names and photos are editable from /admin.
-- `id` is fixed at 1..12 to match `votes.candidate` and `cast_vote()`.
create table if not exists public.contestants (
  id smallint primary key check (id between 1 and 12),
  name text not null check (char_length(name) between 1 and 40),
  photo text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.contestants (id, name)
select g, 'Peserta ' || lpad(g::text, 2, '0')
from generate_series(1, 12) as g
on conflict (id) do nothing;

alter table public.contestants enable row level security;

revoke all on public.contestants from anon, authenticated;
grant select, insert, update on public.contestants to service_role;

-- Public bucket: anyone can read the photos (voters must see them),
-- only the server's service role key can write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 3145728, array['image/jpeg'])
on conflict (id) do update
  set public = true,
      file_size_limit = 3145728,
      allowed_mime_types = array['image/jpeg'];

-- Replacing a photo overwrites the same object, so a plain insert policy is not
-- needed for the service role (it bypasses RLS). Public buckets serve reads
-- through /storage/v1/object/public/ without a policy.
