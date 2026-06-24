-- Escalado de call_logs: índices para filtrar/paginar en BD y función de
-- agregación para las métricas del dashboard (pensado para millones de filas).

create extension if not exists pg_trgm;

-- Listado por agente / dirección, ordenado por fecha (filtros frecuentes).
create index if not exists call_logs_user_agent_ts_idx
  on public.call_logs (user_id, agent_id, start_timestamp desc);
create index if not exists call_logs_user_dir_ts_idx
  on public.call_logs (user_id, direction, start_timestamp desc);
-- (El índice (user_id, start_timestamp desc) ya existe en 0001 para el listado
--  por defecto y los filtros por rango de fechas.)

-- Métricas del dashboard agregadas EN EL SERVIDOR (no se traen filas al cliente).
-- SECURITY INVOKER → respeta RLS: cada cliente solo agrega sus propias llamadas.
-- Devuelve un bucket por hora o por día (en la zona horaria del cliente).
create or replace function public.client_call_series(
  p_from timestamptz,
  p_to timestamptz,
  p_bucket text,
  p_tz text
)
returns table (bucket_key text, calls bigint, cost_cents bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    case
      when p_bucket = 'hour'
        then to_char(date_trunc('hour', (start_timestamp at time zone coalesce(p_tz, 'UTC'))), 'YYYY-MM-DD"T"HH24')
      else to_char(date_trunc('day',  (start_timestamp at time zone coalesce(p_tz, 'UTC'))), 'YYYY-MM-DD')
    end as bucket_key,
    count(*)::bigint as calls,
    coalesce(sum(cost_cents), 0)::bigint as cost_cents
  from public.call_logs
  where start_timestamp >= p_from
    and start_timestamp <= p_to
  group by 1;
$$;
