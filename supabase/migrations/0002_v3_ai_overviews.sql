-- DailyBite v3: cache for the AI progress overview (My progress).
-- One row per user, period (week|month) and local day. "Refresh overview" upserts the same row.
-- Run after 0001_init.sql (SQL Editor, or `supabase db push`).

create table if not exists public.ai_overviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null check (period in ('week', 'month')),
  for_date date not null,
  content jsonb not null,            -- { headline, summary, wins[], noticed[], next: { text, href } }
  source text not null check (source in ('ai', 'rules')),
  basis text not null,               -- "19 meals, 6 journal pages (last 7 days)"
  facts jsonb not null,              -- the fact sheet the overview was written from (no photos, no body data)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period, for_date)
);

drop trigger if exists touch_ai_overviews on public.ai_overviews;
create trigger touch_ai_overviews before update on public.ai_overviews
  for each row execute function public.touch_updated_at();

alter table public.ai_overviews enable row level security;
drop policy if exists own_rows on public.ai_overviews;
create policy own_rows on public.ai_overviews for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists ai_overviews_user_period on public.ai_overviews (user_id, period, for_date desc);
