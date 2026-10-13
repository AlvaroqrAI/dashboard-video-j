-- Horario de apertura por taller. Antes estaba escrito a fuego en el frontend
-- (L-V 07:00–15:00, hora de Madrid), así que los KPIs de "fuera de horario" y el
-- ROI solo eran correctos para un taller con ese horario exacto.
--
-- El valor por defecto es ese mismo horario, así que los perfiles existentes
-- (SRC, Osuna…) conservan sus cifras actuales hasta que lo cambien en Ajustes.
-- Formato: { "tz": "Europe/Madrid", "days": { "mon": {"open":"07:00","close":"15:00"}, …, "sat": null } }
alter table public.profiles
  add column if not exists business_hours jsonb not null default
  '{"tz":"Europe/Madrid","days":{"mon":{"open":"07:00","close":"15:00"},"tue":{"open":"07:00","close":"15:00"},"wed":{"open":"07:00","close":"15:00"},"thu":{"open":"07:00","close":"15:00"},"fri":{"open":"07:00","close":"15:00"},"sat":null,"sun":null}}'::jsonb;
