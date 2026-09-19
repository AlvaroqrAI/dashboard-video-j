-- Precio real del plan mensual que paga cada taller — permite que "Rentabilidad"
-- calcule el ahorro y el coste por cita con la tarifa real del cliente (249 € o 299 €),
-- no siempre con el precio estándar a ciegas.
-- Nullable a propósito: si no está establecido, la app usa 299 € (PLAN_MENSUAL) por defecto,
-- así que aplicar esta migración es seguro en cualquier momento, no rompe nada existente.
alter table public.profiles
  add column if not exists plan_price int;
