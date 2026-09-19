-- Sistema de tickets de soporte: el cliente abre solicitudes y consulta su estado.
-- Empieza vacío en producción a propósito — no hay datos de ejemplo, solo lo que
-- el cliente cree desde el panel.
create table if not exists public.tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  subject     text not null,
  message     text not null,
  status      text not null default 'open' check (status in ('open','in_progress','closed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.tickets enable row level security;

create policy "cliente ve sus tickets"
  on public.tickets for select
  using (auth.uid() = user_id);

create policy "cliente crea sus tickets"
  on public.tickets for insert
  with check (auth.uid() = user_id);

create policy "admin ve todos los tickets"
  on public.tickets for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create index if not exists tickets_user_idx on public.tickets (user_id, created_at desc);
