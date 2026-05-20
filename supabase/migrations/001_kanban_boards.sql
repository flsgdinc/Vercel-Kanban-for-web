-- Kanban desktop sync: one board snapshot per user (full envelope JSON).
-- Apply in Supabase SQL Editor or via: supabase db push / MCP apply_migration

create table if not exists public.kanban_boards (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists kanban_boards_updated_at_idx
  on public.kanban_boards (updated_at desc);

alter table public.kanban_boards enable row level security;

drop policy if exists "kanban_boards_select_own" on public.kanban_boards;
create policy "kanban_boards_select_own"
  on public.kanban_boards for select
  using (auth.uid() = user_id);

drop policy if exists "kanban_boards_insert_own" on public.kanban_boards;
create policy "kanban_boards_insert_own"
  on public.kanban_boards for insert
  with check (auth.uid() = user_id);

drop policy if exists "kanban_boards_update_own" on public.kanban_boards;
create policy "kanban_boards_update_own"
  on public.kanban_boards for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "kanban_boards_delete_own" on public.kanban_boards;
create policy "kanban_boards_delete_own"
  on public.kanban_boards for delete
  using (auth.uid() = user_id);
