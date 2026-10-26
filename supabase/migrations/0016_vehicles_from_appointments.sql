-- Las citas que entran por n8n (SRC, Beecar) solo insertan en appointments, así
-- que el vehículo nunca se creaba. Este trigger lo registra desde la propia cita,
-- venga de donde venga (n8n, Edge Function o panel).
create or replace function public.upsert_vehicle_from_appointment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plate text := upper(trim(new.plate));
  v_id    uuid;
begin
  if v_plate is null or v_plate = '' then
    return new;
  end if;

  -- Misma matrícula aunque venga con o sin espacios ("4562 FGH" = "4562FGH").
  select id into v_id
  from public.vehicles
  where user_id = new.user_id
    and replace(upper(plate), ' ', '') = replace(v_plate, ' ', '')
  limit 1;

  if v_id is null then
    insert into public.vehicles (user_id, plate, car_model, client_name, client_phone)
    values (new.user_id, v_plate, new.car_model, new.client_name, new.client_phone)
    on conflict (user_id, plate) do nothing;
  else
    update public.vehicles
    set car_model    = coalesce(nullif(new.car_model, ''), car_model),
        client_name  = coalesce(nullif(new.client_name, ''), client_name),
        client_phone = coalesce(nullif(new.client_phone, ''), client_phone),
        updated_at   = now()
    where id = v_id;
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_upsert_vehicle on public.appointments;
create trigger appointments_upsert_vehicle
  after insert or update of plate on public.appointments
  for each row execute function public.upsert_vehicle_from_appointment();
