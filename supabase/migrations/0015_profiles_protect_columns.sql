-- SEGURIDAD: un cliente podía cambiarse a sí mismo el rol a 'admin' (y marcar el
-- pago como hecho) con una simple petición a la API, porque la política
-- profiles_update_own solo comprueba que la fila sea suya, y el rol `authenticated`
-- tenía UPDATE sobre todas las columnas. Con role='admin' pasaba a ver los datos
-- de todos los clientes (políticas is_admin() en profiles, agents, call_logs…).
--
-- RLS no puede limitar columnas, así que se protege con un trigger: un usuario
-- normal solo puede modificar los campos no sensibles (full_name, plan_price,
-- business_hours…). Quedan permitidos:
--   · admin (is_admin())                         → panel de administración
--   · sin usuario autenticado (auth.uid() null)  → service role de las Edge
--     Functions (create-client, stripe-webhook, client-billing…) y SQL directo
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.payment_method_added is distinct from old.payment_method_added
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.max_concurrent_appointments is distinct from old.max_concurrent_appointments
     or new.created_at is distinct from old.created_at then
    raise exception 'No tienes permiso para modificar estos campos del perfil'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_columns on public.profiles;
create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();
