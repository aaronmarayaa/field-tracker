begin;

create table public.trips (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  finished_at timestamptz not null check (finished_at >= started_at),
  distance_meters double precision not null check (distance_meters >= 0 and distance_meters < 'Infinity'::double precision),
  duration_seconds double precision not null check (duration_seconds >= 0 and duration_seconds < 'Infinity'::double precision),
  unit text not null check (unit in ('km', 'mi')),
  route jsonb not null default '[]'::jsonb check (jsonb_typeof(route) = 'array' and jsonb_array_length(route) <= 5000),
  background smallint not null default 0 check (background between 0 and 2)
);

create index trips_owner_date_idx on public.trips (user_id, started_at desc, id desc);

alter table public.trips enable row level security;

revoke all on public.trips from public, anon, authenticated;
grant select, insert, update on public.trips to authenticated;

create policy "Read own trips" on public.trips
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Insert own trips" on public.trips
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Update own trips" on public.trips
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';

commit;
