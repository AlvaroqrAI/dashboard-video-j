-- Amplía call_logs para almacenar las llamadas que llegan por el webhook de Retell.
-- A partir de ahora la página de Llamadas se sirve desde la BD (no en vivo desde Retell).

alter table public.call_logs
  add column if not exists agent_name text,
  add column if not exists direction text,                 -- 'inbound' | 'outbound'
  add column if not exists end_timestamp timestamptz,
  add column if not exists transcript text,
  add column if not exists call_summary text,
  add column if not exists user_sentiment text,
  add column if not exists call_successful boolean,
  add column if not exists disconnection_reason text,
  add column if not exists updated_at timestamptz not null default now();

-- El webhook escribe con service_role (ignora RLS); el cliente solo necesita SELECT,
-- que ya está cubierto por la política call_logs_select_own de 0001.
