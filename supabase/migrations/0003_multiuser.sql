-- v5: DailyBite becomes multi-user.
--
-- The tables were already built for this: 0001 enables RLS on all fifteen with
-- `user_id = auth.uid()`, and the photos bucket already keys on the first folder
-- segment. What was missing is a per-account key for the MCP server, which has no
-- session to read and so cannot use auth.uid().
--
-- Safe to run twice.

-- a key each, so anyone can point their own Claude at their own data -----------
alter table public.settings
  add column if not exists mcp_key text;

update public.settings
   set mcp_key = encode(gen_random_bytes(24), 'hex')
 where mcp_key is null;

alter table public.settings
  alter column mcp_key set default encode(gen_random_bytes(24), 'hex'),
  alter column mcp_key set not null;

create unique index if not exists settings_mcp_key on public.settings(mcp_key);

-- A new account needs its settings row before it can have a key, and the app reads
-- settings on its first page load anyway — but a row created the moment the account
-- exists means the key is there even if the first thing they do is open Claude.
create or replace function public.settings_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.settings_for_new_user();

-- Looking a key up happens on the service-role client, which bypasses RLS, so no
-- policy is needed here. Nothing else may read another row's key:
drop policy if exists own_rows on public.settings;
create policy own_rows on public.settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
