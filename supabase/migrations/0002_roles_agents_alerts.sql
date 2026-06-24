-- Roles (admin / cliente), agentes asignados y alertas.

-- =====================================================================
-- Rol en el perfil
-- =====================================================================
alter table public.profiles
  add column if not exists role text not null default 'client'
    check (role in ('admin', 'client'));

-- Estado de onboarding: el cliente debe añadir método de pago antes de usar el sistema.
alter table public.profiles
  add column if not exists payment_method_added boolean not null default false;

-- Helper: ¿el usuario actual es admin? (evita recursión en políticas RLS)
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- El admin puede ver y gestionar todos los perfiles.
create policy "profiles_admin_all"
  on public.profiles for all
  using (public.is_admin());

-- =====================================================================
-- Agentes asignados a un cliente
-- =====================================================================
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  retell_agent_id text,
  name text not null,
  status text not null default 'active' check (status in ('active', 'paused')),
  created_at timestamptz not null default now()
);

alter table public.agents enable row level security;

create policy "agents_select_own"
  on public.agents for select
  using (auth.uid() = user_id or public.is_admin());

create policy "agents_admin_write"
  on public.agents for all
  using (public.is_admin());

create index if not exists agents_user_idx on public.agents (user_id);

-- =====================================================================
-- Alertas que el admin asigna a un cliente (p.ej. impago)
-- =====================================================================
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null default 'info'
    check (type in ('info', 'warning', 'payment', 'critical')),
  title text not null,
  message text,
  is_read boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.alerts enable row level security;

create policy "alerts_select_own"
  on public.alerts for select
  using (auth.uid() = user_id or public.is_admin());

create policy "alerts_admin_write"
  on public.alerts for all
  using (public.is_admin());

create index if not exists alerts_user_idx on public.alerts (user_id, created_at desc);
