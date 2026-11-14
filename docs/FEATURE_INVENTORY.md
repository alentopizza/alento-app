# Inventario funcional de Alentó App

Última auditoría: **2026-10-27**

Este documento es el índice canónico entre lo que existe en `main` y la documentación funcional del proyecto. Su objetivo es evitar dos fallas:

1. implementar una función sin documentarla;
2. mantener documentación de una función que ya no existe o cambió de ruta.

Ante una discrepancia, revisar primero el código vigente, corregir el documento canónico del módulo y actualizar este inventario en el mismo cambio.

## Superficie pública

| Ruta | Estado | Función | Documento canónico |
| --- | --- | --- | --- |
| `/` | Activa | Home pública y acceso al menú | `README.md`, `docs/SEO.md` |
| `/menu` | Activa | Catálogo público | `docs/CURRENT_STATE.md`, `docs/SEO.md` |
| `/menu/[slug]` | Activa | Página indexable de producto | `docs/SEO.md` |
| `/menu/categoria/[slug]` | Activa | Página indexable de categoría | `docs/SEO.md` |
| `/cart` | Activa | Carrito, selección de entrega, cupones y checkout público | `docs/PUBLIC_CHECKOUT_MAPS.md`, `docs/COUPONS.md` |
| `/club` | Condicional | Club Alentó para invitado/cliente; se oculta/redirige si Club está desactivado | `docs/CLUB_POINTS.md` |
| `/login` | Activa | Login unificado cliente/colaborador | `docs/AUTH_ROLES_AND_PUBLIC_APP.md` |
| `/cuenta` | Activa | Perfil privado de cliente | `docs/AUTH_ROLES_AND_PUBLIC_APP.md` |
| `/seguimiento/[token]` | Activa | Seguimiento firmado del pedido | `docs/DRIVERS.md`, `docs/PUBLIC_CHECKOUT_MAPS.md` |
| `/ubicacion` | Activa | Landing SEO de ubicación/horarios | `docs/SEO.md` |
| `/domicilios` | Activa | Landing SEO de cobertura/domicilios | `docs/SEO.md` |

## Superficie interna

| Ruta | Acceso | Función | Documento canónico |
| --- | --- | --- | --- |
| `/interno` | ADMIN / POS / CASHIER | Punto de venta con borrador local persistente | `docs/POS.md`, `docs/POS_DRAFT_AND_WHATSAPP.md` |\n| `/mensajes` | ADMIN / POS / CASHIER | Bandeja interna de conversaciones del inbox de WhatsApp de Chatwoot | `docs/POS_DRAFT_AND_WHATSAPP.md` |
| `/pedidos` | ADMIN / POS / CASHIER | Operación y edición de pedidos | `docs/ORDERS.md` |
| `/cocina` | ADMIN / KITCHEN | Producción | `docs/KITCHEN.md` |
| `/clientes` | ADMIN / POS | CRM operativo | `docs/CUSTOMERS.md` |
| `/interno/menu` | ADMIN | Administración del catálogo | `docs/MENU.md` |
| `/cupones` | ADMIN | Cupones, estadísticas y visibilidad por canal POS/Carrito | `docs/COUPONS.md` |
| `/caja` | ADMIN / CASHIER | Caja, ingresos, salidas, préstamos, nómina | `docs/PAYMENTS_AND_CASH.md` |
| `/turnos` | ADMIN | Calendario y costo de turnos | `docs/SHIFTS.md` |
| `/club-alento` | ADMIN | Configuración/administración de Club | `docs/CLUB_POINTS.md` |
| `/notificaciones` | ADMIN | Push manual + automatizaciones WhatsApp | `docs/PUSH_NOTIFICATIONS.md` |
| `/metricas` | ADMIN | Analítica propia e integraciones de medición | `docs/METRICS_AND_TRACKING.md` |
| `/auditoria` | ADMIN | Historial inmutable de acciones sensibles | `docs/AUDIT_LOG.md` |
| `/salud-sistema` | ADMIN | Salud técnica, alertas, jobs e integraciones | `docs/OBSERVABILITY.md` |
| `/configuracion` | ADMIN | Sede, horarios, domicilios, repartidores, clientes y pagos | `docs/CONFIGURATION.md` |
| `/personalizacion` | ADMIN | Imágenes de Home y hero público | `README.md`, `docs/CURRENT_STATE.md` |
| `/usuarios` | ADMIN | Usuarios, roles y permisos sensibles | `docs/AUTH_ROLES_AND_PUBLIC_APP.md` |
| `/masa` | ADMIN / KITCHEN | Preparación de masa exclusiva de Alentó | `docs/ALENTO_EXCLUSIVE_MODULES.md` |

## Repartidor

| Ruta | Acceso | Función | Documento canónico |
| --- | --- | --- | --- |
| `/repartidor` | DRIVER / DISPATCH | Home, solicitudes, mapa, desempeño y cartera | `docs/DRIVERS.md` |
| `/repartidor/pedido/[token]` | enlace firmado + flujo autorizado | Checklist, navegación y estados de entrega | `docs/DRIVERS.md` |

## Rutas auxiliares activas

- `/pedidos/[id]/imprimir`: impresión térmica de pedido.
- `GET /api/orders/[id]/receipt-image`: comprobante PNG generado en servidor.
- `/caja/nomina/[id]/imprimir`: comprobante de pago de nómina.
- `/setup/admin`: bootstrap del primer ADMIN; deja de permitir creación después del primer usuario.
- `/sin-acceso`: salida controlada por permisos.
- `/integraciones/chatwoot`: Dashboard App exclusivo de la instalación de Alentó; ver `docs/ALENTO_EXCLUSIVE_MODULES.md`.

## Capacidades transversales implementadas

### Pedidos programados

Implementados en POS, Pedidos, Cocina, impresión, despacho y Repartidor.

- `Order.scheduledFor`;
- validación contra horario de servicio;
- fecha comercial de venta: `scheduledFor` cuando existe, `createdAt` en pedidos inmediatos;
- Caja excluye del día actual ventas programadas para otra fecha;
- cobro real bloqueado antes de la fecha programada;
- ingreso a Cocina 30 minutos antes;
- estados y despacho/repartidor bloqueados antes de la ventana;
- el pedido continúa visible y editable/reprogramable/cancelable antes de iniciar preparación.

Documentos: `docs/POS.md`, `docs/ORDERS.md`, `docs/KITCHEN.md`, `docs/PAYMENTS_AND_CASH.md`.

### Devoluciones auditables

Pedidos y Caja soportan devoluciones parciales y totales sin borrar el cobro original.

- `PaymentRefund` conserva valor, medio, motivo, referencia, fecha y responsable;
- refund idempotente para evitar duplicados;
- `PAYMENT_REFUNDED` queda visible en Auditoría;
- Caja conserva la entrada original por `paidAt` y muestra la devolución por `refundedAt`;
- el cierre esperado descuenta devoluciones;
- saldo, edición y cancelación usan dinero neto recibido;
- un pago con devoluciones queda protegido contra borrado físico;
- la cancelación de un pedido cobrado requiere devolver primero el saldo neto recibido.

Documento: `docs/PAYMENTS_AND_CASH.md`.

### Edición estructurada de pedidos

Pedidos puede modificar cantidades, notas, agregar productos configurables y reabrir pizzas existentes, incluidas pizzas de dos sabores. La configuración se normaliza server-side y las líneas históricas sin `productId` mantienen compatibilidad.

Documentos: `docs/ORDERS.md`, `docs/ORDER_DATA_INTEGRITY.md`.

### Reparto y GPS

Incluye disponibilidad, autoasignación atómica, capacidad simultánea, geocerca, GPS, checklist persistente, navegación, rutas múltiples, seguimiento del cliente, desempeño y cartera.

Documento: `docs/DRIVERS.md`.

### Push y WhatsApp

`/notificaciones` contiene dos áreas:

- campañas Web Push manuales con audiencia, imagen, acción y métricas;
- automatizaciones WhatsApp transaccionales.

Documento: `docs/PUSH_NOTIFICATIONS.md`.

### Turnos y nómina

`WorkShift` alimenta el pago desde Caja. Un pago de nómina crea salida, `PayrollPayment`, relación con turnos y descuentos de préstamos cuando aplican. La eliminación del movimiento, mientras la sesión siga abierta, revierte de forma transaccional sus efectos.

Documentos: `docs/SHIFTS.md`, `docs/PAYMENTS_AND_CASH.md`.

### Cupones por canal

Cupones soporta un interruptor maestro y visibilidad independiente en POS/Carrito. POS y WEB comparten elegibilidad canónica con `normalizeOrderLine`; el checkout público usa `/api/public-checkout/eligibility` y nunca descuenta domicilio.

Documento: `docs/COUPONS.md`.

### Club Puntos activable

`club_alento_settings.enabled` controla si Club aparece en la navegación pública y si se acreditan puntos nuevos. Desactivarlo no borra saldos existentes ni bloquea otros efectos del cierre de pedidos.

Documento: `docs/CLUB_POINTS.md`.

### Auditoría administrativa

`/auditoria` permite al ADMIN consultar el historial inmutable de acciones sensibles sobre pedidos, estados, pagos, Caja, usuarios/roles, cupones y configuración.

La presentación visible usa español Colombia mientras los códigos técnicos persistidos conservan compatibilidad.

Documento: `docs/AUDIT_LOG.md`.

### Observabilidad de producción

`/salud-sistema` concentra salud técnica, request IDs, alertas agregadas, estado de PostgreSQL, Notifier, Web Push, Google Maps y trabajos programados.

Endpoints principales:

- `GET /api/health`;
- `GET /api/observability/summary`;
- `POST /api/observability/test`;
- `PATCH /api/observability/incidents/[id]`;
- `POST /api/observability/client-error` (público con rate limit).

Documento: `docs/OBSERVABILITY.md`.

### Rendimiento de navegación pública

- la navegación inferior cambia visualmente desde el primer toque y mantiene prefetch;
- `/cart` y `/club` disponen de `loading.tsx`;
- `/cart` carga diferidamente `PublicCheckoutDelivery` y `PublicCheckoutCustomer`;
- Club invitado no realiza `router.refresh()` periódico.

### SEO público

Existen metadata, sitemap, robots, datos estructurados, páginas de producto/categoría y landings locales `/ubicacion` y `/domicilios`.

Documento: `docs/SEO.md`.

## APIs y servicios de soporte sin página propia

Estas rutas forman parte de capacidades ya documentadas y no representan módulos independientes:

- `GET /api/health`: health check de despliegue; ver `docs/DEPLOYMENT.md`.
- `/api/catalog` y `/api/menu-admin`: proyección pública/operativa y administración del catálogo; ver `docs/MENU.md`.
- `/api/coupons` y `/api/coupons/[id]`: administración/consulta de cupones por canal; ver `docs/COUPONS.md`.
- `/api/discount/eligibility`: elegibilidad interna de descuentos POS; protegida para operación.
- `/api/public-checkout/eligibility`: elegibilidad pública segura del carrito WEB; ver `docs/COUPONS.md`.
- `/api/club-settings`: GET de configuración Club y PUT protegido para ADMIN; ver `docs/CLUB_POINTS.md`.
- `IngredientGroup`: subcategorías administrables para ingredientes, consumidas dinámicamente por Arma Tu Pizza en cliente y POS; ver `docs/MENU.md`.
- `/api/product-images` y `/api/product-images/[id]`: carga persistente y entrega pública de imágenes oficiales de producto; ver `docs/MENU.md`.
- `/api/public-home` y `/api/public-home-admin`: Home/personalización pública.
- `/api/public-store-status`: estado público de apertura/cierre.
- `/api/notification-templates`, `/api/notification-images`, `/api/push-campaigns` y `/api/push`: infraestructura de notificaciones; ver `docs/PUSH_NOTIFICATIONS.md`.
- `/api/internal/notification-jobs/run`: ejecución interna de trabajos de notificación programados.
- `/api/receipt-logo` y `/api/orders/[id]/receipt-image`: soporte de impresión/PNG; ver `docs/ORDERS.md`.
- `/api/analytics/delivery-zones`: analítica de zonas; ver `docs/DELIVERY_ZONE_ANALYTICS.md`.
- `/api/dough-preparations`: persistencia del módulo exclusivo de masa; ver `docs/ALENTO_EXCLUSIVE_MODULES.md`.

## Integraciones externas

No existe una integración operativa activa con marketplaces externos.

Las extensiones propias vigentes de Alentó —Chatwoot, notifier/WhatsApp y módulo de masa— están delimitadas en `docs/ALENTO_EXCLUSIVE_MODULES.md`.

### Compatibilidad histórica de OrderSource

`OrderSource` conserva un valor legacy de marketplace en Prisma únicamente por compatibilidad con PostgreSQL/datos históricos. No existe ruta, UI, credencial ni flujo operativo que lo utilice. No retirar valores de enum directamente mientras el arranque ejecute `prisma db push`; primero debe hacerse una migración controlada de cualquier fila histórica.

## Regla documental obligatoria

Todo cambio funcional debe incluir, en el mismo trabajo:

1. código;
2. documento canónico del módulo;
3. este inventario si cambia una ruta, módulo, acceso o capacidad transversal;
4. `docs/CURRENT_STATE.md` si cambia el estado general del producto;
5. `docs/DEPLOYMENT.md` si cambia infraestructura, variables o schema.

No considerar una función terminada si falta su actualización documental.
