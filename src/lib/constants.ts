// Constantes de negocio compartidas entre páginas (Dashboard, Rentabilidad...).
// Antes vivían duplicadas dentro de cada página; centralizadas aquí para que
// un cambio de precio no haya que tocarlo en varios sitios.

// Ticket medio de referencia por cita (facturación estimada del taller).
// TODO: en cuanto un taller tenga tarifas propias en `services`, sustituir
// por la media real de precios de sus servicios activos.
export const TICKET_MEDIO = 300

// Precio del plan mensual estándar de MecanIA (299€/mes, sin permanencia).
// TODO: cuando el precio esté en Stripe/subscriptions por cliente, leerlo de ahí
// en vez de este valor fijo.
export const PLAN_MENSUAL = 299

// Coste anual de referencia de una recepcionista a jornada completa en España.
// Es el argumento de venta ya verificado de MecanIA (ver dossier comercial).
export const COSTE_SECRETARIA_ANUAL = 27000
