-- Tabla de citas agendadas por el agente de voz
create table if not exists appointments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  call_id         text references call_logs(call_id) on delete set null,

  -- Datos del cliente
  client_name     text,
  client_phone    text,

  -- Vehículo
  car_model       text,
  plate           text,

  -- Cita
  reason          text,
  appointment_date date not null,
  appointment_time time not null,

  -- Estado
  status          text not null default 'pending', -- pending | confirmed | cancelled

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Índices
create index on appointments(user_id, appointment_date);
create index on appointments(appointment_date, appointment_time);

-- Capacidad máxima por taller (en profiles)
alter table profiles
  add column if not exists max_concurrent_appointments int not null default 2;

-- RLS
alter table appointments enable row level security;

create policy "cliente ve sus citas"
  on appointments for select
  using (auth.uid() = user_id);

create policy "cliente inserta sus citas"
  on appointments for insert
  with check (auth.uid() = user_id);

create policy "cliente actualiza sus citas"
  on appointments for update
  using (auth.uid() = user_id);

create policy "admin ve todas"
  on appointments for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "service role sin restricciones"
  on appointments for all
  using (true)
  with check (true);
