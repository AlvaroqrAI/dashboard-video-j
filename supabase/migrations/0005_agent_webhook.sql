-- Webhook a nivel de agente (agent-level webhook URL de Retell) y visibilidad
-- de las llamadas para el administrador.

-- URL del webhook configurada en Retell para este agente (se guarda como registro).
alter table public.agents
  add column if not exists webhook_url text;

-- El admin puede ver TODAS las llamadas (el cliente solo las suyas, política de 0001).
drop policy if exists "call_logs_admin_select" on public.call_logs;
create policy "call_logs_admin_select"
  on public.call_logs for select
  using (public.is_admin());
