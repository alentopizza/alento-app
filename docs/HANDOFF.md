# Handoff y continuidad del proyecto

Última auditoría: **2026-10-26**

Este documento permite que una nueva persona, desarrollador o IA retome Alentó App sin depender del historial de conversaciones.

## Lectura obligatoria

Leer en este orden:

1. `AGENTS.md`
2. `README.md`
3. `docs/HARDENING_CHECKLIST.md`
4. `docs/CURRENT_STATE.md`
5. `docs/FEATURE_INVENTORY.md`
6. `docs/PRODUCTION_READINESS.md` como baseline histórico
7. `docs/ALENTO_EXCLUSIVE_MODULES.md`
8. `docs/ROADMAP.md`
9. documento canónico del módulo a modificar
10. `docs/ARCHITECTURE.md`
11. `docs/ORDER_DATA_INTEGRITY.md`
12. `docs/AUTH_ROLES_AND_PUBLIC_APP.md`
13. `docs/CONFIGURATION.md`
14. `docs/DRIVERS.md`
15. `docs/PAYMENTS_AND_CASH.md`
16. `docs/METRICS_AND_TRACKING.md`
17. `docs/PUSH_NOTIFICATIONS.md`
18. `docs/MAPS_VISUAL_SYSTEM.md`
19. `docs/COUPONS.md`
20. `docs/CLUB_POINTS.md`
21. `docs/DEPLOYMENT.md`
22. `prisma/schema.prisma`
23. archivos del módulo que se vaya a modificar.

Después revisar commits recientes de `main`.

## Ciclo de hardening en curso

El checklist canónico vive en `docs/HARDENING_CHECKLIST.md`.

Regla obligatoria durante este ciclo: trabajar **un punto a la vez** y no iniciar el siguiente hasta que el punto actual esté implementado, validado, documentado y el usuario autorice continuar.

Estado al 2026-10-26:

- #1 Builds reproducibles: completado;
- #2 CI automatizada: completado;
- #3 Pruebas automatizadas críticas: completado (31 tests / 5 archivos);
- #4 Baseline Prisma + migraciones seguras: completado técnicamente; producción ya reconoció la baseline y el start fue cambiado a `prisma migrate deploy`. Falta solo confirmar el redeploy final;
- #5 Backups y restauración verificada: siguiente punto pendiente, no iniciar hasta confirmación del redeploy del #4.

Si se retoma el proyecto en una nueva conversación, continuar desde el primer punto no completado del checklist.

## Fuente de verdad

Orden de prioridad:

```text
1. comportamiento actual del código
2. prisma/schema.prisma
3. documento canónico del módulo
4. CURRENT_STATE / ROADMAP
5. historial de commits
6. historial de chats
```

Si documentación y código discrepan, verificar el comportamiento real y actualizar la documentación en el mismo bloque.

## Protocolo de cambio seguro

Alentó App está en producción. Antes de modificar cualquier módulo:

1. leer `AGENTS.md` y el documento canónico del módulo;
2. buscar primero si la acción, regla, componente, endpoint, parser, validador o helper ya existe;
3. identificar y reutilizar la fuente de verdad existente antes de crear un flujo nuevo;
4. revisar los archivos de UI, API, tipos y helpers directamente relacionados;
5. revisar `prisma/schema.prisma` si el cambio toca persistencia;
6. buscar referencias del tipo, campo, estado o función que se va a cambiar;
7. revisar los commits recientes del área para detectar decisiones todavía en transición;
8. definir explícitamente qué comportamiento actual debe permanecer intacto.

Durante la implementación:

- preferir una solución de sistema sobre parches aislados, pero aplicar cambios incrementales que no arriesguen la operación actual;
- si existe una forma más simple, mantenible o coherente con la arquitectura, explicarla y usarla salvo que contradiga una decisión explícita;
- mantener una única fuente de verdad para tipos y reglas compartidas; si existe una implementación reutilizable, extenderla en vez de crear un flujo paralelo;
- no duplicar helpers, tipos globales o lógica de Google Maps/autenticación si ya existe un módulo compartido;
- si una decisión afecta varias superficies, actualizar todas en el mismo bloque: UI, API, persistencia, documentación y estados derivados.

Antes de considerar terminado un cambio:

- actualizar `docs/FEATURE_INVENTORY.md` si cambió una ruta, módulo, acceso o capacidad transversal;

- buscar referencias antiguas que hayan quedado obsoletas;
- revisar inicializadores, ramas alternativas y estados vacíos;
- comprobar implicaciones para POS, WEB, Clientes, Club, Caja, Cocina o Pedidos cuando compartan datos;
- verificar si el cambio de schema requiere sincronización de Prisma y revisar `package.json`/`docs/DEPLOYMENT.md` antes de indicar pasos manuales;
- revisar TypeScript de los componentes relacionados para evitar cadenas de errores de build;
- actualizar documentación canónica y `HANDOFF.md` si cambia una regla de negocio.

En el despliegue actual, `npm run start` ejecuta `prisma migrate deploy && next start -p 3000`. Por tanto, todo cambio de `prisma/schema.prisma` debe incluir una migración nueva en `prisma/migrations`. No usar `db push` como mecanismo normal de producción.

Este protocolo existe para evitar iteraciones donde un cambio funcional correcto genere regresiones por tipos, imports, estados derivados o contratos desalineados entre módulos.
## Cambios recientes que no deben perderse — 2026-10-26

### Cupones

- `Coupon.active` es el interruptor maestro.
- `Coupon.visibleInPos` controla POS.
- `Coupon.visibleInCart` controla checkout público.
- cupones existentes: POS visible por defecto, carrito oculto por defecto.
- POS y WEB calculan elegibilidad con `normalizeOrderLine`.
- `/api/discount/eligibility` es interno; el cliente usa `/api/public-checkout/eligibility`.
- el domicilio nunca recibe descuento de cupón.
- si todo el carrito está en promoción/no elegible, la app no muestra cupones y explica que la compra no aplica.
- la selección pública de cupón vive en Entrega/Totales, no en Tus datos.

Documento canónico: `docs/COUPONS.md`.

### Rendimiento de la app pública

- `PublicMobileNav` responde visualmente desde el primer toque y precarga destinos.
- `/cart` y `/club` tienen estados `loading.tsx`.
- `/cart` carga de forma dinámica `PublicCheckoutDelivery` y `PublicCheckoutCustomer`; no volver a hacer imports estáticos sin medir el impacto.
- Club invitado no usa refresco completo periódico; autenticado usa una frecuencia más conservadora.

### Club Puntos

- `club_alento_settings.enabled` es el interruptor maestro.
- al desactivar Club: se oculta de navegación, `/club` redirige a `/menu` y se pausan nuevas acreditaciones.
- no borrar saldos/movimientos históricos al desactivar.
- desactivar Club no debe cortar otros efectos de cerrar un pedido `COMPLETED`.

### Arranque

Comando vigente:

```bash
prisma db push && next start -p 3000
```

Los backfills de ganancias de repartidor e IngredientGroup son históricos/manuales y no deben reintroducirse en cada arranque.

## Módulos cerrados

Están cerrados para la etapa operativa actual:

- Punto de venta;
- Pedidos;
- Cocina;
- Clientes;
- Menú.

Documentos canónicos:

- `docs/POS.md`
- `docs/ORDERS.md`
- `docs/KITCHEN.md`
- `docs/CUSTOMERS.md`
- `docs/MENU.md`

"Cerrado" no significa congelado para siempre. Significa que:

- el flujo aprobado ya existe;
- no se debe rediseñar por iniciativa propia;
- bugs sí se corrigen;
- pequeñas mejoras visuales sí pueden hacerse;
- cambios estructurales requieren solicitud explícita;
- toda modificación debe respetar reglas de no regresión.

## Mapa para reconstrucción

### Punto de venta

Ruta: `/interno`

La raíz `/` corresponde a la experiencia pública del cliente.

Entrada principal:

- `src/components/StructuredPosPageV2.tsx`

Dependencias críticas:

- `GET /api/catalog`
- `POST /api/orders`
- `src/lib/orderLineNormalizer.ts`
- `src/lib/orderConfiguration.ts`
- `src/lib/orderCode.ts`

Responsabilidad: construir una orden válida y estructurada.

### Pedidos

Ruta: `/pedidos`

Archivos principales:

- `src/app/pedidos/page.tsx`
- `src/components/OrdersCardsDashboardV3.tsx`
- `src/components/OrderEditStructuredAdder.tsx`
- `src/components/ActionConfirmModal.tsx`

Responsabilidad: administrar una orden ya creada, pagos, cliente, impresión, cancelación, eliminación y estados posteriores a Cocina.

### Cocina

Ruta: `/cocina`

Archivos principales:

- `src/app/cocina/page.tsx`
- endpoints de prepared/status en `src/app/api/orders/[id]/...`
- `src/lib/orderPresentation.ts`
- `src/lib/orderWorkflow.ts`

Responsabilidad: preparación, no finanzas.

### Clientes

Ruta: `/clientes`

Archivos principales:

- `src/app/clientes/page.tsx`
- `src/app/api/customers/**`
- `src/lib/customerCsv.ts`

Responsabilidad: CRM operativo, historial y administración de datos.

### Menú

Ruta: `/interno/menu`

Archivos principales:

- `src/app/interno/menu/page.tsx`
- `src/app/api/menu-admin/route.ts`
- `src/app/api/catalog/route.ts`

Responsabilidad: administrar el catálogo que consume POS.

Regla crítica:

```text
Category.name = nombre visible
Category.slug = identificador interno estable
Product.categoryId = relación real
Product.type = comportamiento estructural
```

No confundir estos conceptos.

## Dependencias entre módulos

```text
Menú
  ↓
/api/catalog
  ↓
POS
  ↓
Order + OrderItem.configuration
  ↓
Pedidos
  ↓
Cocina
  ↓
Estados posteriores / Caja
```

Clientes se relaciona con Order mediante `customerId`, pero no debe ser utilizado como usuario interno.

## Integridad estructurada

Cada orden debe guardar de forma estructurada qué se vendió.

No reemplazar configuración por texto de ticket.

Pizzas y combos deben conservar IDs reales y snapshots de tamaño, sabores, porciones, bordes, modificadores, grupos, opciones y cantidades.

Esta estructura alimenta:

- Cocina;
- impresión;
- edición;
- inventario futuro;
- recetas;
- costos;
- rentabilidad.

## Menú: reglas que una IA no debe inferir

- renombrar categoría no cambia slug;
- categorías base pueden moverse/renombrarse pero no eliminarse;
- categoría personalizada solo se elimina vacía;
- el orden de categorías viene de `Category.sortOrder`;
- el orden normal de productos viene de `Product.sortOrder`;
- Destacados usa `Product.featured` y orden propio en `AppSetting`;
- una categoría personalizada crea actualmente productos `STANDARD`;
- `ProductType` todavía es enum fijo;
- modificadores avanzados son backlog, no comportamiento implementado;
- extras están deshabilitados para pizzas de dos sabores hasta definir alcance por mitad.

## Pagos y Caja

Medio previsto no significa ingreso.

- `PENDING`: intención.
- `PAID`: dinero recibido.

Caja solo debe contar `PAID`.

## Consecutivo

`Order.id` es técnico.

Usar `Order.sequenceNumber` + `Order.source`.

No reutilizar números eliminados.

## Estados

Domicilio:

```text
PREPARING → PREPARED → READY → OUT_FOR_DELIVERY → ARRIVED → DELIVERED → COMPLETED
```

Recoger/Local:

```text
PREPARING → PREPARED → READY → COMPLETED
```

Cocina controla únicamente la preparación hasta `PREPARED`.

Convención operativa:

- `PREPARING` = Preparando en Cocina;
- `PREPARED` = Horneando y ya fuera del tablero de Cocina;
- `READY` = salió del horno / listo.

El hornero/operación realiza `PREPARED → READY`. No devolver esa acción a Cocina.

## Eliminaciones

### Pedido

```text
Activo → Cancelar → Eliminar
```

### Producto

No eliminar si tiene historial o dependencias de combo.

### Categoría

No eliminar categoría base.

No eliminar categoría personalizada con productos.

### Cliente

La semántica está documentada en `CUSTOMERS.md`; no extrapolar reglas de otros modelos.

## Autenticación

La primera versión ya existe.

Colaboradores:

- `User` separado de `Customer`;
- correo + contraseña;
- roles múltiples;
- cookie `alento_staff_session`;
- `/login`;
- `/usuarios`;
- middleware para páginas y APIs internas principales.

Clientes:

- navegación pública y checkout WEB disponibles sin login obligatorio;
- teléfono + OTP opcional mediante proveedor externo de Alentó;
- `CustomerAccount`;
- cookie `alento_customer_session`;
- login unificado en `/login`;
- `/cuenta`.

Variables y activación están documentadas en `docs/AUTH_ROLES_AND_PUBLIC_APP.md` y `docs/DEPLOYMENT.md`.

No confundir autorización visual con autorización server-side.

## Sistema visual de mapas

Documento canónico: `docs/MAPS_VISUAL_SYSTEM.md`.

Regla obligatoria:

- tienda/origen usa `createAlentoMapPinElement()`;
- repartidor usa `createDriverMapPinElement()`;
- domicilio usa `createDeliveryMapPinElement(orderCode)`;
- cuando el pedido ya existe, el pin del domicilio muestra su consecutivo;
- checkout o selección de dirección sin pedido usan el mismo pin rojo sin número;
- no duplicar marcadores en componentes ni volver a pines predeterminados de Google para estas entidades;
- mapas nuevos deben consumir `src/lib/alentoMapMarker.ts`.

## Métricas e integraciones

Documento canónico: `docs/METRICS_AND_TRACKING.md`.

`/metricas` ya está implementado y separa:

- métricas internas propias de Alentó;
- integraciones externas de medición/publicidad.

Archivos críticos:

- `src/app/metricas/page.tsx`;
- `src/lib/publicAnalytics.ts`;
- `src/components/PublicTracking.tsx`;
- `src/lib/trackingSettings.ts`;
- `src/app/api/metrics/**`.

Reglas de no regresión:

- la analítica interna no depende de Meta/Google/TikTok/Clarity;
- una plataforma no debe conectarse a la vez de forma directa y mediante GTM;
- los eventos de checkout/compra conservan líneas reales del carrito;
- UTM tiene prioridad sobre referrer;
- el consentimiento externo no bloquea la compra;
- “Guardar y probar” valida configuración técnica, pero la recepción final se confirma en el panel del proveedor.

Las integraciones con marketplaces externos siguen fuera del alcance actual. No reintroducirlas experimentalmente sin acceso oficial y diseño aprobado.

## Configuración de autenticación en una instalación nueva

La autenticación ya está implementada y activa en la instalación operativa. Para una instalación nueva:

1. configurar `AUTH_SESSION_SECRET`;
2. configurar `AUTH_BOOTSTRAP_KEY`;
3. revisar el diff de Prisma y desplegar; `npm run start` ejecuta `prisma db push` automáticamente;
4. crear el primer ADMIN desde `/setup/admin`;
5. crear colaboradores desde `/usuarios`;
6. configurar `MAKE_WHATSAPP_OTP_WEBHOOK_URL` únicamente cuando se vaya a habilitar el login OTP de clientes.

## Prisma en producción

No existe baseline formal de Prisma Migrate.

El despliegue actual todavía ejecuta `prisma db push` al arrancar; esto es una condición temporal de la etapa de construcción, no la meta de producción estable.

Antes de cambiarla:

1. backup de PostgreSQL;
2. verificar schema real;
3. crear baseline;
4. separar migración y start.

No usar `prisma migrate deploy` sobre la base actual hasta completar ese baseline.

## Regla obligatoria de documentación

Todo cambio funcional relevante debe actualizar:

- documento canónico del módulo;
- `CURRENT_STATE.md` si cambia estado/comportamiento;
- `ROADMAP.md` si cambia fase;
- `README.md` si cambia arquitectura/objetivo global;
- `DEPLOYMENT.md` si cambia infraestructura/Prisma.

## Al cerrar un bloque

Registrar:

- commit;
- comportamiento añadido/cambiado;
- archivos principales;
- endpoints;
- datos/modelos involucrados;
- reglas de no regresión;
- impacto de schema y efecto del `prisma db push` automático del arranque;
- prueba mínima después de redeploy.

La documentación del repositorio tiene prioridad sobre el historial de chats.

## Experiencia pública actual

Estado funcional auditado al 2026-10-24.

### Home pública

- `/` es la Home principal aprobada.
- Slider de acceso hacia `/menu`.
- Imagen móvil administrable `1080 × 2160 px`.
- Imagen de escritorio administrable `1920 × 1080 px`.
- Configuración en `AppSetting(public.home)`.
- La PWA inicia en `/`.

Regla de no regresión: no rediseñar la Home principal sin solicitud explícita.

### Menú, configurador y carrito

- `/menu` es el catálogo público oficial.
- `/interno/menu` es la administración interna.
- `/menu` consume `GET /api/catalog`.
- pizzas, dos sabores y combos conservan configuración estructurada;
- `/cart` conserva el carrito público persistente;
- navegación pública compartida: Menú, Carrito, Club y Perfil en la parte inferior para móvil, tablet y escritorio.

### Checkout y Google Maps

Documento canónico: `docs/PUBLIC_CHECKOUT_MAPS.md`.

Estado actual:

- Recoger en tienda es la modalidad inicial;
- Domicilio habilita Google Places y GPS solo por acción del usuario;
- dirección guardada solo para cliente autenticado y de forma no bloqueante;
- no se muestra mapa sin destino validado;
- la ruta se calcula en servidor con Google Routes;
- mapa `3:4` con ruta Alentó → cliente;
- Ruta, Domicilio y Tiempo integrados en la parte superior;
- cobertura y tarifa provienen de bandas activas del sistema.

La creación pública ya existe mediante `/api/public-checkout` y genera pedidos `source=WEB`. El endpoint recalcula productos y domicilio en servidor, crea cliente invitado cuando corresponde, reutiliza clientes existentes por teléfono sin exponer datos privados y devuelve seguimiento firmado.

`POST /api/orders` sigue siendo el flujo interno protegido y crea `source=POS`.

### Eliminación definitiva de pedidos

El módulo Pedidos permite eliminar definitivamente órdenes `CANCELED` y `COMPLETED` cuando el usuario tiene permiso `DELETE_ORDERS`.

Reglas de no regresión:

- no habilitar borrado para estados activos;
- eliminar explícitamente `ClubPointTransaction` antes de borrar un pedido finalizado;
- pagos e items se eliminan junto con la orden;
- notificaciones relacionadas usan cascada;
- un pedido finalizado borrado desaparece también de historial, métricas y puntos del cliente;
- esta acción es de mantenimiento y no sustituye Cancelar.

### Checkout público en página completa

El cierre del pedido dentro de `/cart` usa pasos de página:

- `cart`;
- `delivery`;
- `customer`.

`PublicCheckoutDelivery` y `PublicCheckoutCustomer` aceptan `fullPage`.

No volver a convertir estos pasos en modales centrados, porque Google Maps, ruta y pago requieren más espacio.

### Dirección única de clientes

Regla operativa definitiva:

- cada cliente usa una sola dirección;
- la dirección válida debe tener `formattedAddress`, `placeId`, `latitude` y `longitude`;
- POS, `/clientes` y checkout público usan Google Maps para validarla;
- si solo existe texto heredado, debe mostrarse como **Requiere actualización**;
- no mostrar selectores de Casa/Trabajo/múltiples direcciones;
- guardar o usar una dirección válida reemplaza la anterior y elimina duplicados heredados;
- `CustomerAddress` sigue siendo una relación técnica separada para conservar compatibilidad con pedidos históricos, pero operacionalmente solo se usa un registro activo por cliente.

### Regla de pedidos cancelados

- un pedido cancelado sigue visible tanto para el cliente como en su ficha interna;
- en `/clientes`, conservar siempre el histórico completo para análisis conductual;
- mostrar cantidad y porcentaje de cancelaciones como métrica separada;
- nunca mezclar cancelaciones con compras válidas, ticket promedio, frecuencia o total comprado;
- un pedido cancelado sigue visible en el historial del cliente con etiqueta `CANCELADO`;
- no cuenta dentro de las métricas de pedidos/compras válidas;
- nunca debe sumar puntos Club;
- al cancelar, eliminar cualquier `ClubPointTransaction` ligado al pedido;
- al calcular saldo Club, ignorar movimientos cuyo pedido esté `CANCELED`;
- esta doble protección cubre tanto flujo nuevo como datos históricos inconsistentes.

### Club Alentó

- `/club` funciona como invitado y autenticado;
- tasa predeterminada: 5% del subtotal elegible;
- domicilio no suma;
- 1 punto = $1 COP;
- compra mínima predeterminada de canje: $14.900;
- acreditación al quedar pagado y COMPLETED;
- el canje transaccional completo sigue pendiente.

### Pedido activo del cliente

Convención de estados visible desde 2026-09-22:

- `PREPARING` = Preparando;
- `PREPARED` = Horneando;
- al entrar en `PREPARED`, el pedido desaparece de Cocina;
- `READY` = Listo / Listo para recoger;
- la transición `PREPARED → READY` la realiza el hornero/operación;
- no crear un nuevo enum HORNEANDO salvo que una necesidad futura requiera distinguir técnicamente cocción de PREPARED.

Clientes autenticados:

- `GET /api/auth/customer/active-order` devuelve hasta 5 pedidos activos de la sesión, ordenados del más antiguo al más nuevo;
- `PublicActiveOrderBanner` se reutiliza en `/menu` y `/cart`;
- usa 4 etapas según modalidad;
- nunca debe buscar pedidos por un teléfono arbitrario cuando existe sesión;
- el teléfono verificado queda bloqueado en checkout mientras la sesión esté activa.

Invitados:

- no reciben el banner interno;
- el popup final explica que el seguimiento llegará por mensaje;
- pueden abrir el enlace firmado inmediatamente;
- se ofrece iniciar sesión para incorporar el seguimiento a la experiencia de la app.

Efectivo:

- `cashReceived` es opcional;
- solo validar monto mínimo si el cliente decidió escribirlo;
- no bloquear Confirmar compra por dejar ese campo vacío.

### Repartidor y seguimiento

- `Order.driverId` y `driverAssignedAt` ya existen;
- asignación a DRIVER o legacy DISPATCH;
- enlace firmado para el repartidor;
- `/repartidor/pedido/[token]`;
- checklist obligatorio antes de salir;
- el checklist de productos del repartidor se persiste en `OrderItem` y queda asociado al `driverId` que lo verificó;
- el checklist ya no usa `localStorage`: dos dispositivos abiertos con la misma orden ven el mismo avance mediante la base de datos y el refresco automático;
- una reasignación de repartidor no reutiliza como válidos los checks hechos por el driver anterior;
- **Compartir ubicación en tiempo real** es obligatorio antes de `READY → OUT_FOR_DELIVERY`;
- el cliente usa `navigator.geolocation.watchPosition()` y mantiene una lectura GPS activa;
- el endpoint de estado exige checklist completo + lectura GPS válida de máximo 60 segundos para aceptar `OUT_FOR_DELIVERY`;
- la ubicación del repartidor se persiste en `Order.driverLatitude / driverLongitude / driverLocationAccuracy / driverLocationUpdatedAt`;
- flujo del pedido para driver: `READY → OUT_FOR_DELIVERY → ARRIVED → DELIVERED`;
- al confirmar `DELIVERED`, la ficha se cierra y el repartidor vuelve a `/repartidor`; cualquier segundo dispositivo abierto en esa orden también termina redirigido al refrescar;
- `/repartidor` es la home exclusiva del DRIVER/DISPATCH autenticado;
- disponibilidad del repartidor: `User.driverAvailable` + última ubicación general en `User.driverLatitude / driverLongitude / driverLocationAccuracy / driverLocationUpdatedAt`;
- **Activo** habilita GPS general y autoasignación; **Inactivo** apaga el watch local y limpia la ubicación general del servidor;
- la home muestra todos los domicilios en proceso; los no asignados en estados `CONFIRMED / PREPARING / PREPARED / READY` se pueden autoasignar;
- Solicitudes consulta cambios cada 2.5 s; cuando aparece un domicilio nuevo el mapa se reencuadra una sola vez para incluir el nuevo pin sin volver a bloquear la navegación libre del repartidor;
- el mapa muestra también el origen oficial **🏠 Alentó Pizza** usando las coordenadas guardadas en `pos_settings.store`;
- las tarjetas del carrusel son solo de acceso: al tocar tarjeta o pin se abre el detalle completo (cliente, dirección, productos, pago y totales);
- **Autoasignarme** vive únicamente dentro del detalle de la solicitud; no reintroducir la acción directa en la tarjeta;
- la autoasignación usa una actualización atómica con `driverId: null` para evitar que dos repartidores tomen el mismo pedido;
- pedidos ya asignados a otro repartidor siguen visibles pero no se pueden reclamar; los propios permiten abrir directamente su ficha;
- navegación inferior exclusiva del repartidor: **Solicitudes / Desempeño / Cartera**; Desempeño y Cartera ya consumen `/api/repartidor/finances` y muestran entregas, ganancias, pagos y saldo;
- `/seguimiento/[token]` se refresca automáticamente;
- durante `OUT_FOR_DELIVERY`, el seguimiento del cliente muestra nombre del repartidor, distancia restante, ETA y mapa en vivo con la moto;
- el endpoint firmado `/api/seguimiento/[token]/delivery-live` expone únicamente la ubicación de esa orden y puede recalcular ruta con Routes API;
- el cliente consulta ubicación con mayor frecuencia y recalcula ruta/ETA con menor frecuencia para no sobrerrequerir Google Routes;
- cuando el repartidor marca `ARRIVED`, el módulo de mapa del cliente desaparece al refrescar el estado.

El siguiente paso del rastreo puede ser mejorar animación/heading de la moto y decidir cuánto tiempo conservar o anonimizar la ubicación histórica.

### Datos del cliente en checkout

- comprar como invitado no exige login;
- nombre y teléfono son obligatorios para finalizar;
- si existe sesión de cliente, nombre/teléfono/correo se autocompletan;
- si el cliente escribe un teléfono y quiere recuperar datos previos, debe verificarlo por WhatsApp antes de mostrar información guardada;
- la verificación crea/usa `CustomerAccount` y deja la sesión iniciada;
- un invitado sin verificación puede completar la compra y queda asociado al `Customer` operativo por teléfono;
- nunca exponer nombre, correo o direcciones solo por consultar un teléfono públicamente.

### Regla al continuar

No crear una segunda lógica pública para precios, combos, rutas o pedidos. El flujo WEB reutiliza `normalizeOrderLine`, configuración estructurada, bandas de domicilio, consecutivo global y estados existentes.


## Límite entre núcleo y módulos exclusivos

Antes de preparar una versión para terceros, leer `docs/ALENTO_EXCLUSIVE_MODULES.md`.

No considerar parte del núcleo genérico:

- receta/preparación de masa de Alentó;
- plantillas e infraestructura Meta/WhatsApp/notifier de Alentó;
- integración Chatwoot de la instalación actual.

Estas capacidades pueden existir en el repositorio operativo de Alentó sin convertirse por ello en requisitos de una distribución comercial genérica.
