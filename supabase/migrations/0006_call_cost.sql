-- Coste de la llamada (en céntimos) para calcular el gasto desde la BD.
-- Retell lo envía en call.call_cost.combined_cost (céntimos).
alter table public.call_logs
  add column if not exists cost_cents integer;
