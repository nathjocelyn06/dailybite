-- DailyBite (formerly Nutrigo) schema. Run once in Supabase > SQL Editor (or `supabase db push`).
-- Every table has user_id + row level security, so the web app (logged-in user)
-- only sees its own rows. The MCP server uses the service role key and MUST
-- filter by OWNER_USER_ID itself (see lib/services).

create extension if not exists pgcrypto;

-- updated_at helper ---------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- settings (one row per user) ----------------------------------------------
create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  timezone text not null default 'Asia/Seoul',
  kcal_goal int not null default 1800,
  protein_goal_g int not null default 90,
  carbs_goal_g int not null default 220,
  fat_goal_g int not null default 60,
  water_goal int not null default 8,
  monthly_budget numeric(12,2) not null default 400000,
  currency text not null default 'KRW',
  fridge_color text not null default '#CFE0EA',
  show_insights boolean not null default true,
  personalize_insights boolean not null default true,
  updated_at timestamptz not null default now()
);

-- meals: the single source of truth for food intake -----------------------
-- status: planned (meal plan) -> pending_confirm (AI estimate) -> eaten.
-- Only status = 'eaten' counts toward calories.
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date not null,
  slot text not null check (slot in ('breakfast','lunch','dinner','snack')),
  status text not null default 'eaten' check (status in ('planned','pending_confirm','eaten')),
  name text not null,
  items jsonb not null default '[]'::jsonb,       -- [{name, portion, kcal, protein_g, carbs_g, fat_g}]
  kcal int,
  protein_g numeric(7,1),
  carbs_g numeric(7,1),
  fat_g numeric(7,1),
  photo_path text,                                -- storage path in bucket "photos"
  place text,
  notes text,
  recipe_id uuid,
  estimate_source text check (estimate_source in ('ai','manual','recipe')),
  eaten_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meals_user_date on public.meals(user_id, date);

-- water ---------------------------------------------------------------------
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date not null,
  glasses int not null default 0 check (glasses >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

-- expenses ------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date not null,
  merchant text not null,
  category text not null check (category in ('daily_food','groceries','snacks_drinks','other')),
  amount numeric(12,2) not null check (amount >= 0),
  items jsonb not null default '[]'::jsonb,       -- [{name, qty, unit, price}]
  receipt_path text,
  note text,
  meal_id uuid references public.meals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists expenses_user_date on public.expenses(user_id, date);

-- fridge --------------------------------------------------------------------
create table if not exists public.fridge_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  category text not null default 'other'
    check (category in ('veg_fruit','protein','dairy_eggs','frozen','pantry','other')),
  qty numeric(10,2) not null default 1 check (qty >= 0),
  unit text not null default 'pcs',
  purchased_on date,
  expires_on date,
  low_at numeric(10,2) not null default 1,
  status text not null default 'stocked' check (status in ('pending','stocked','used_up','removed')),
  source_expense_id uuid references public.expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fridge_user_status on public.fridge_items(user_id, status);

-- history of fridge changes (for Archive > fridge history)
create table if not exists public.fridge_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  item_id uuid references public.fridge_items(id) on delete cascade,
  item_name text not null,
  kind text not null check (kind in ('add','confirm','use','restock','edit','remove')),
  delta numeric(10,2),
  created_at timestamptz not null default now()
);

-- fridge door decorations (stickers, photos, post-its)
create table if not exists public.fridge_decor (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('photo','strip','postit','note','badge','magnet','calendar','receipt')),
  x int not null default 150,
  y int not null default 300,
  rot int not null default 0,
  z int not null default 0,
  text text,
  color text,
  photo_path text,
  updated_at timestamptz not null default now()
);

-- shopping list -------------------------------------------------------------
create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  qty numeric(10,2) not null default 1,
  unit text not null default 'pcs',
  est_price numeric(12,2),
  reason text,                                    -- recipe | low_stock | meal_plan | manual
  recipe_id uuid,
  bought boolean not null default false,
  bought_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- journal -------------------------------------------------------------------
create table if not exists public.journal_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date not null,
  kind text not null default 'day' check (kind in ('day','week_plan')),
  title text,
  review text,
  mood text,
  fullness text,
  layout text not null default 'scrapbook',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date, kind)
);

create table if not exists public.journal_elements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  page_id uuid not null references public.journal_pages(id) on delete cascade,
  kind text not null check (kind in ('photo','sticker','tape','text','doodle','meal_card','mood','habit')),
  x numeric(7,2) not null default 10,              -- percent of page width
  y numeric(7,2) not null default 10,              -- px from page top
  w numeric(7,2) not null default 30,              -- percent of page width
  h numeric(7,2),
  rot numeric(6,2) not null default 0,
  z int not null default 0,
  text text,
  data jsonb not null default '{}'::jsonb,         -- doodle paths, sticker id, colours...
  meal_id uuid references public.meals(id) on delete set null,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- recipes (saved + user's own) --------------------------------------------
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  source text not null default 'mine' check (source in ('mine','themealdb')),
  external_id text,
  title text not null,
  category text,
  area text,
  thumb_url text,
  video_url text,
  source_url text,
  ingredients jsonb not null default '[]'::jsonb,  -- [{name, measure}]
  steps text,
  minutes int,
  difficulty text check (difficulty in ('Easy','Medium','Hard')),
  diet_tags text[] not null default '{}',
  kcal_per_serving int,
  servings int,
  folder text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

-- progress ------------------------------------------------------------------
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  target numeric(10,2),
  progress numeric(10,2) not null default 0,
  unit text,
  period text not null default 'week' check (period in ('day','week','month','once')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date not null,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Body photo journal: private, opt-in. AI comparison text is only stored when the
-- user runs it and can be deleted. Never shown on dashboard.
create table if not exists public.body_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date not null,
  photo_path text not null,
  note text,
  ai_comparison text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- notifications -------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('expiry','low_stock','meal_plan','budget')),
  title text not null,
  body text,
  ref_table text,
  ref_id uuid,
  href text,
  dedupe_key text not null,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

-- triggers + RLS for every table -------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['settings','meals','water_logs','expenses','fridge_items','fridge_decor',
    'shopping_items','journal_pages','journal_elements','recipes','goals','reflections',
    'body_photos','notifications']
  loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s
                    for each row execute function public.touch_updated_at()', t);
  end loop;

  foreach t in array array['settings','meals','water_logs','expenses','fridge_items','fridge_events',
    'fridge_decor','shopping_items','journal_pages','journal_elements','recipes','goals',
    'reflections','body_photos','notifications']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format('create policy own_rows on public.%I for all
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- realtime: the web app refreshes live when Claude (MCP) or another device edits
do $$
declare t text;
begin
  foreach t in array array['meals','water_logs','expenses','fridge_items','fridge_decor',
    'shopping_items','journal_pages','journal_elements','notifications']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- storage: private bucket, files stored under <user_id>/...
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "photos own read" on storage.objects;
create policy "photos own read" on storage.objects for select
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos own write" on storage.objects;
create policy "photos own write" on storage.objects for insert
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos own update" on storage.objects;
create policy "photos own update" on storage.objects for update
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos own delete" on storage.objects;
create policy "photos own delete" on storage.objects for delete
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
