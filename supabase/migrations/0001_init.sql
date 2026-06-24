-- Esquema inicial del Voice Dashboard
-- Cada cliente (auth.users) tiene un perfil, una integración con Retell y datos sincronizados.

-- =====================================================================
-- Perfiles de cliente
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Crea el perfil automáticamente al registrarse un usuario.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Integración con Retell AI (la API key se guarda cifrada, NO legible por el cliente)
-- =====================================================================
create table if not exists public.retell_integrations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  api_key_encrypted text not null,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz
);

alter table public.retell_integrations enable row level security;

-- El cliente puede saber si tiene integración, pero nunca leer la clave.
-- (La columna cifrada solo la lee el backend con service_role, que ignora RLS.)
create policy "retell_select_own"
  on public.retell_integrations for select
  using (auth.uid() = user_id);

-- =====================================================================
-- Suscripciones de Stripe
-- =====================================================================
create table if not exists public.subscriptions (
  id text primary key,                       -- stripe subscription id
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null,
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- =====================================================================
-- Caché local de datos de Retell (para evitar llamar a la API en cada carga)
-- =====================================================================
create table if not exists public.call_logs (
  call_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  agent_id text,
  call_type text,
  call_status text,
  from_number text,
  to_number text,
  duration_ms integer,
  start_timestamp timestamptz,
  recording_url text,
  raw jsonb,
  created_at timestamptz not null default now()
);

alter table public.call_logs enable row level security;

create policy "call_logs_select_own"
  on public.call_logs for select
  using (auth.uid() = user_id);

create index if not exists call_logs_user_idx on public.call_logs (user_id, start_timestamp desc);
