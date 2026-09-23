# Handoff y continuidad del proyecto

Este documento permite que una nueva persona, desarrollador o IA retome Alentó App sin depender del historial de conversaciones.

## Lectura obligatoria

Leer en este orden:

1. `README.md`
2. `docs/CURRENT_STATE.md`
3. `docs/ROADMAP.md`
4. `docs/POS.md`
5. `docs/ORDERS.md`
6. `docs/KITCHEN.md`
7. `docs/CUSTOMERS.md`
8. `docs/MENU.md`
9. `docs/ARCHITECTURE.md`
10. `docs/ORDER_DATA_INTEGRITY.md`
11. `docs/ORDER_NUMBERING.md`
12. `docs/PAYMENTS.md`
13. `docs/PAYMENTS_AND_CASH.md`
14. `docs/AUTH_ROLES_AND_PUBLIC_APP.md`
15. `docs/DEPLOYMENT.md`
16. `prisma/schema.prisma`
17. archivos del módulo que se vaya a modificar.

Después revisar commits recientes de `main`.

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

Ruta: `/menu`

Archivos principales:

- `src/app/menu/page.tsx`
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

- navegación pública futura sin login obligatorio;
- teléfono + OTP de WhatsApp;
- `CustomerAccount`;
- cookie `alento_customer_session`;
- `/cuenta/login`;
- `/cuenta`.

Variables y activación están documentadas en `docs/AUTH_ROLES_AND_PUBLIC_APP.md` y `docs/DEPLOYMENT.md`.

No confundir autorización visual con autorización server-side.

## Integraciones

Integraciones externas son la última fase.

No reintroducir Rappi/DiDi experimentalmente sin acceso oficial y diseño aprobado.

## Activación pendiente después del cambio de autenticación

Antes de probar login en un despliegue existente:

1. configurar `AUTH_SESSION_SECRET`;
2. configurar `AUTH_BOOTSTRAP_KEY`;
3. ejecutar `npx prisma db push`;
4. crear el primer ADMIN desde `/setup/admin`;
5. crear colaboradores desde `/usuarios`;
6. configurar WhatsApp cuando se vaya a probar login de clientes.

## Prisma en producción

No existe baseline formal de Prisma Migrate.

Cuando cambie schema:

```bash
npx prisma db push
```

No usar `prisma migrate deploy` hasta realizar baseline.

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
- necesidad o no de `npx prisma db push`;
- prueba mínima después de redeploy.

La documentación del repositorio tiene prioridad sobre el historial de chats.

## Experiencia pública actual

Estado reconstruido al 2026-09-22.

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

No volver a convertir estos pasos en modales centrados, porque direcciones múltiples, Google Maps, ruta y pago requieren más espacio.

### Direcciones múltiples de clientes

Captura vigente:

- POS y `/clientes` usan `GoogleCustomerAddressPicker`;
- las direcciones nuevas se seleccionan desde Google Places;
- el punto se muestra en mapa y se valida con Routes/cobertura;
- evitar reintroducir un input libre como captura principal de dirección;
- barrio e indicaciones son datos complementarios editables manualmente.

### Direcciones múltiples de clientes

`CustomerAddress` es una colección y no debe volver a reducirse a un único campo `address`.

Reglas vigentes:

- POS y `/clientes` permiten agregar, editar, eliminar y marcar principal;
- la dirección principal (`isDefault=true`) es solo la preferida;
- al eliminar la principal, se promueve automáticamente la primera restante;
- el checkout POS permite elegir qué dirección guardada usar en cada domicilio;
- el checkout público también muestra todas las direcciones guardadas del cliente autenticado;
- la principal es solo la selección inicial; al elegir otra se recalculan Google Routes, cobertura, tarifa, tiempo y mapa;
- no sobrescribir la dirección principal al editar datos básicos del cliente;
- los endpoints de administración son `/api/customers/[id]/addresses` y `/api/customers/[id]/addresses/[addressId]`.

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
- `READY → OUT_FOR_DELIVERY → ARRIVED`;
- `/seguimiento/[token]` se refresca automáticamente.

GPS en vivo del repartidor y el icono de la moto sobre el mapa siguen pendientes.

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
