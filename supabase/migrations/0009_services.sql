-- Catálogo de servicios por taller + soporte de presupuestos en citas.
-- Cada taller define sus servicios (precio, duración, si requiere presupuesto).

create table if not exists services (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,

  name            text not null,
  aliases         text,              -- sinónimos para que el agente lo reconozca
  price_text      text,              -- "120 €", "20-25 €", "15 €/rueda"
  duration_min    int  not null default 60,

  requires_quote  boolean not null default false,  -- true = no da precio, deriva
  quote_fields    text,              -- datos que debe pedir el agente
  blocks_capacity boolean not null default true,   -- false = no ocupa elevador
  bookable        boolean not null default true,   -- false = sin cita (paso libre)

  operator        text,              -- operario concreto si aplica (ej. A/C)
  notes           text,
  active          boolean not null default true,

  created_at      timestamptz not null default now()
);

create index on services(user_id, active);

-- Datos de la cita ligados al servicio
alter table appointments
  add column if not exists service_name    text,
  add column if not exists duration_min    int not null default 60,
  add column if not exists is_quote        boolean not null default false,
  add column if not exists blocks_capacity boolean not null default true,
  add column if not exists quote_data      text;

-- RLS: cada taller ve y edita sus servicios; admin todo.
-- (service_role ignora RLS por diseño: NO se crea política permisiva.)
alter table services enable row level security;

create policy "services_select_own"
  on services for select
  using (auth.uid() = user_id or public.is_admin());

create policy "services_write_own"
  on services for all
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- FIX SEGURIDAD (auditoría C1): política permisiva sin restricción de rol
-- que exponía las citas de todos los talleres entre sí.
drop policy if exists "service role sin restricciones" on appointments;
