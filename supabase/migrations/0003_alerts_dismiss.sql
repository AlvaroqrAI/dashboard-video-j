-- El cliente puede cerrar (descartar) sus alertas in-app y no volver a verlas.
-- Excepción: las alertas de pago (type = 'payment') NO se pueden cerrar.

alter table public.alerts
  add column if not exists dismissed boolean not null default false;

-- Índice para la consulta del cliente (sus alertas no descartadas, recientes).
create index if not exists alerts_user_active_idx
  on public.alerts (user_id, created_at desc)
  where dismissed = false;

-- El cliente puede actualizar (descartar) SUS propias alertas que NO sean de pago.
-- Las políticas se combinan con OR: el admin sigue teniendo acceso total por
-- "alerts_admin_write". El WITH CHECK evita reasignar la alerta a otro usuario
-- y bloquea el descarte de las de pago.
drop policy if exists "alerts_dismiss_own" on public.alerts;
create policy "alerts_dismiss_own"
  on public.alerts for update
  using (auth.uid() = user_id and type <> 'payment')
  with check (auth.uid() = user_id and type <> 'payment');
