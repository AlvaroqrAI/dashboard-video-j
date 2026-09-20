-- V3: reconocimiento de vehículo por matrícula + seguimiento de reparaciones.
-- El agente ya guarda matrícula/modelo/cliente en cada cita (appointments); esta
-- tabla los convierte en un registro persistente por matrícula, para reconocer
-- al cliente que repite sin que tenga que repetir sus datos.
create table if not exists public.vehicles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  plate        text not null,
  car_model    text,
  client_name  text,
  client_phone text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, plate)
);

alter table public.vehicles enable row level security;

create policy "cliente ve sus vehiculos"
  on public.vehicles for select
  using (auth.uid() = user_id);

create policy "cliente gestiona sus vehiculos"
  on public.vehicles for insert
  with check (auth.uid() = user_id);

create policy "cliente actualiza sus vehiculos"
  on public.vehicles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "service role sin restricciones vehicles"
  on public.vehicles for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create index if not exists vehicles_user_plate_idx on public.vehicles (user_id, plate);

-- Estado de la reparación de un vehículo. El taller lo actualiza a mano desde
-- el panel; cuando pasa a 'listo' se dispara el SMS al cliente y el agente de
-- voz puede consultarlo si el cliente llama preguntando.
create table if not exists public.repairs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  vehicle_id     uuid not null references public.vehicles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  status         text not null default 'recibido'
                   check (status in ('recibido','diagnostico','en_reparacion','listo','entregado')),
  description    text,
  notes          text,
  sms_sent_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.repairs enable row level security;

create policy "cliente ve sus reparaciones"
  on public.repairs for select
  using (auth.uid() = user_id);

create policy "cliente crea sus reparaciones"
  on public.repairs for insert
  with check (auth.uid() = user_id);

create policy "cliente actualiza sus reparaciones"
  on public.repairs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "service role sin restricciones repairs"
  on public.repairs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create index if not exists repairs_user_status_idx on public.repairs (user_id, status);
create index if not exists repairs_vehicle_idx on public.repairs (vehicle_id);
