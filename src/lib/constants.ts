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

// Coste mensual estimado de las llamadas (minutos de la plataforma de voz), que
// se factura aparte de la cuota. Se suma a la cuota para comparar con la
// secretaria con el coste real del servicio, no solo el de la suscripción.
export const LLAMADAS_MENSUAL_ESTIMADO = 200

// Ganancia media de un trabajo de taller: valor de cada llamada atendida fuera de
// horario (cliente que sin Sara se habría ido a otro taller).
export const GANANCIA_POR_LLAMADA_FUERA = 200

// Parte de esas llamadas que acaba en trabajo para el taller (estimación conservadora).
export const CONVERSION_FUERA_HORARIO = 0.5
