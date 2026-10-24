# Estado actual del proyecto

Última actualización: 2026-10-24.

Este documento resume el comportamiento vigente de Alentó App y es una de las primeras referencias que debe leer una persona o IA al retomar el proyecto.

## Baseline de producción 2026-09-23

`docs/PRODUCTION_READINESS.md` conserva la revisión funcional de salida realizada en septiembre. Para el estado vigente usar este documento y `docs/FEATURE_INVENTORY.md`.

Cambios ya vigentes que prevalecen sobre referencias históricas posteriores de este documento:

- checkout WEB ya crea pedidos `source=WEB`;
- `CustomerAddress` ya persiste `formattedAddress`, `placeId`, latitude y longitude;
- el repartidor ya dispone de home propia, disponibilidad, GPS, autoasignación, límite simultáneo, checklist, navegación, rutas múltiples y cierre de entrega;
- el cliente ya ve seguimiento en vivo del repartidor con mapa, distancia y ETA;
- Pedidos ya dispone de Mapa De Entregas, asignación/desasignación y rutas múltiples;
- Desde el Mapa De Entregas, operación puede activar o desconectar repartidores. La desconexión remota limpia el GPS y se bloquea si el repartidor aún tiene domicilios asignados; la activación inicia GPS cuando la app del repartidor está abierta y con permisos.
- el domicilio se calcula automáticamente con Google Routes tanto al crear como al editar;
- Caja básica y pagos parciales/mixtos están implementados;
- Club acumula y muestra puntos, pero el canje transaccional sigue pendiente;
- `/masa`, notificaciones Meta/notifier y Chatwoot son extensiones exclusivas de Alentó, documentadas en `docs/ALENTO_EXCLUSIVE_MODULES.md`.

Pendientes de producción más importantes: baseline/estrategia de Prisma, CI automatizada, refund, hardening futuro de sesiones y decisión de alcance del canje Club.

## Módulos cerrados

Los siguientes módulos están **CERRADOS PARA LA ETAPA OPERATIVA ACTUAL**:

```text
Punto de venta   ✅
Pedidos          ✅
Cocina           ✅
Clientes         ✅
Menú             ✅
```

"Cerrado" significa:

- comportamiento operativo aprobado;
- estructura principal definida;
- documentación canónica disponible;
- pueden corregirse bugs y pequeños problemas de UX;
- no deben reabrirse decisiones de diseño o alcance salvo solicitud explícita.

Referencias canónicas:

- `docs/POS.md`
- `docs/ORDERS.md`
- `docs/KITCHEN.md`
- `docs/CUSTOMERS.md`
- `docs/MENU.md`

## Estado general

Alentó App ya funciona como sistema interno para:

- POS;
- clientes;
- catálogo;
- pedidos;
- Cocina;
- pagos;
- Caja;
- cupones;
- configuración;
- impresión térmica.

La primera versión de autenticación y autorización por roles ya está implementada para colaboradores. También existe acceso opcional de clientes por teléfono + OTP de WhatsApp.

Cupones, Caja y Configuración existen, pero no están incluidos en el grupo de cinco módulos declarados cerrados en esta actualización.

Las integraciones externas no bloquean el núcleo. El módulo `/metricas` ya implementa analítica propia y conexiones opcionales de medición/publicidad para Meta Pixel, Google Analytics 4, TikTok Pixel, Microsoft Clarity, Google Tag Manager y Google Ads. Chatwoot y el ecosistema WhatsApp/notifier continúan siendo extensiones exclusivas de Alentó; ver `docs/ALENTO_EXCLUSIVE_MODULES.md`.


## Módulos operativos adicionales ya implementados

Además de los cinco módulos cerrados:

- **Configuración** (`/configuracion`): sede, horarios, cobertura/tarifas, repartidores, clientes y medios de pago. Documento: `docs/CONFIGURATION.md`.
- **Turnos** (`/turnos`): calendario, costos y estados de pago. Documento: `docs/SHIFTS.md`.
- **Nómina en Caja**: pago de turnos, descuentos de préstamos, comprobante y reversión transaccional mientras la sesión siga abierta.
- **Notificaciones** (`/notificaciones`): campañas Web Push manuales y automatizaciones WhatsApp. Documento: `docs/PUSH_NOTIFICATIONS.md`.
- **Repartidor** (`/repartidor`): disponibilidad, GPS, autoasignación, navegación, seguimiento, desempeño y cartera. Documento: `docs/DRIVERS.md`.
- **Cupones** (`/cupones`): administración y métricas de uso.
- **Personalización** (`/personalizacion`): imágenes públicas de Home y hero.
- **SEO local**: páginas indexables de producto/categoría más `/ubicacion` y `/domicilios`. Documento: `docs/SEO.md`.

El inventario completo de rutas, capacidades y documentos canónicos vive en `docs/FEATURE_INVENTORY.md`.

## Métricas y medición — V1 implementada

Ruta: `/metricas`

Documento canónico: `docs/METRICS_AND_TRACKING.md`.

El módulo separa:

- **Métricas internas**: visitas, personas únicas, productos, carrito, checkout, pedidos, abandono, venta atribuida, mapa de calor día/hora, embudo y origen del tráfico;
- **Integraciones externas**: configuración guiada, verificación y consentimiento para plataformas de medición/publicidad.

Eventos internos soportados:

```text
MENU_VIEW
PRODUCT_VIEW
ADD_TO_CART
CART_VIEW
CHECKOUT_STARTED
CART_EMPTIED
ORDER_CREATED
```

Conexiones disponibles:

- Meta Pixel;
- Google Analytics 4;
- TikTok Pixel;
- Microsoft Clarity;
- Google Tag Manager;
- Google Ads.

Estado actual de la instalación de Alentó:

- Meta Pixel configurado y validado hasta checkout;
- Google Analytics 4 configurado y validado en tiempo real hasta checkout;
- TikTok Pixel configurado y validado hasta `InitiateCheckout`;
- Microsoft Clarity configurado;
- Google Tag Manager pendiente/no necesario mientras se usen conexiones directas;
- Google Ads pendiente por decisión de negocio.

Regla crítica: no conectar la misma plataforma de forma directa y además dentro de Google Tag Manager, porque duplicaría eventos.

La analítica interna debe seguir funcionando aunque los rastreadores externos estén desactivados o el usuario no otorgue consentimiento.

## Infraestructura

- Next.js 15 + React 19 + TypeScript.
- Tailwind CSS 4.
- Prisma 6 + PostgreSQL.
- EasyPanel/VPS.
- Proyecto EasyPanel: `app_alento`.
- Servicio: `alento-app`.
- Base: `alento-db`.
- URL pública canónica configurada: `https://alentopizza.com/`.

`.env.example` y `src/lib/seo.ts` usan `https://alentopizza.com` como URL pública. No documentar Glide como plataforma pública vigente ni tratar un alias/subdominio técnico como dominio canónico.

## Punto de venta — cerrado

Ruta: `/interno`

Soporta:

- Domicilio, Recoger y Local;
- búsqueda, creación y edición de clientes;
- dirección obligatoria para Domicilio;
- búsqueda rápida de productos;
- categorías y orden heredados de Menú;
- destacados con orden independiente;
- tarjetas visuales 1:1;
- pizzas de uno y dos sabores;
- tamaños;
- bordes;
- ingredientes extra en pizzas de un sabor;
- extras deshabilitados en pizzas de dos sabores;
- notas cortas por pizza;
- combos configurables;
- productos simples;
- cupones/descuentos;
- intención de pago;
- creación transaccional del pedido;
- consecutivo comercial global;
- recálculo server-side.
- pedidos inmediatos o programados desde el cierre del POS;

Ver `docs/POS.md`.

## Pedidos — cerrado

Ruta: `/pedidos`

Permite:

- búsqueda y filtros;
- tarjetas compactas;
- detalle lateral;
- edición de modalidad;
- edición estructurada de líneas;
- pizzas y combos configurados;
- cliente y dirección;
- notas;
- pagos parciales;
- múltiples medios;
- eliminación de pagos erróneos;
- saldo;
- impresión térmica;
- cancelación;
- eliminación definitiva después de cancelar;
- continuación de estados posteriores a Cocina.
- edición del horario entre **Lo antes posible** y **Programar pedido** sin recrear la orden;
- identificación visual de pedidos programados con reloj y acento violeta.

La tarjeta muestra un solo estado financiero: `PAGO PENDIENTE` o `PAGADO`.

Ver `docs/ORDERS.md`.

## Cocina — cerrado

Ruta: `/cocina`

Incluye:

- hasta 3 pedidos por fila;
- prioridad pizzas → antojos → otros preparables;
- bebidas excluidas;
- preparación por `preparedQuantity`;
- auto `PREPARED`;
- acción `PREPARED → READY`;
- cronómetro;
- cliente;
- jerarquía tamaño/borde/sabores/extras/nota;
- notas visibles en mayúsculas visuales;
- controles ocultos al completar una línea.
- entrada automática de pedidos programados 30 minutos antes de la hora solicitada;
- los pedidos programados solo aceptan fechas/horas incluidas en el horario de servicio configurado para cada día; creación y edición lo validan también en backend;
- alerta sonora al entrar a Cocina, cuando las alertas están habilitadas en el dispositivo;
- bloqueo de preparación anticipada y exclusión temporal de despacho/repartidores.

Ver `docs/KITCHEN.md`.

## Clientes — cerrado

Ruta: `/clientes`

Incluye:

- búsqueda;
- filtros por estado;
- estados Nuevo / Activo / Frecuente / Por recuperar / Sin compras;
- contadores;
- métricas;
- perfil;
- historial estructurado;
- impresión de copias;
- edición;
- eliminación individual;
- importación CSV;
- plantilla oficial;
- exportación CSV;
- explicación de filas omitidas;
- eliminación masiva de clientes sin pedidos;
- permiso de eliminación masiva controlado desde Configuración.

La única importación/exportación de datos operativa y soportada en producción es la de **Clientes**. Los flujos temporales usados para cargar pedidos, ingresos, salidas y préstamos al iniciar el sistema fueron retirados.

Ver `docs/CUSTOMERS.md`.

## Menú — cerrado

Ruta: `/menu`

Incluye:

- categorías horizontales;
- creación y renombrado de categorías;
- drag & drop de categorías;
- eliminación de categorías personalizadas vacías;
- protección de categorías base;
- herencia automática del nuevo nombre por relación `categoryId`;
- creación y edición de productos;
- imágenes principal/secundaria;
- búsqueda;
- tarjetas visuales;
- drag & drop de productos;
- orden independiente de Destacados;
- switches Activo / Visible en POS / Destacado;
- eliminación segura de productos;
- constructor de combos;
- sincronización de orden/nombres con POS.

Mejoras futuras registradas, no incluidas en el cierre:

- administración avanzada de tipos de producto;
- sistema de modificadores/grupos de modificadores.

Ver `docs/MENU.md`.

## Integridad estructurada

`OrderItem.configuration` es la fuente estructurada de lo vendido.

Pizzas conservan IDs y snapshots de:

- tamaño;
- sabores;
- porciones;
- borde;
- modificadores cuando aplican.

Combos conservan:

- producto padre;
- reglas;
- pizzas;
- grupos;
- opciones;
- cantidades.

`OrderItem.notes` guarda instrucciones breves de preparación por pizza.

Ver `docs/ORDER_DATA_INTEGRITY.md`.

## Pedidos programados

`Order.scheduledFor` es opcional.

Para pedidos con preparación:

```text
Programado fuera de ventana → CONFIRMED
30 min antes → visible en Cocina
Preparación completa → PREPARED
```

La ventana compartida es de 30 minutos y vive en `src/lib/orderScheduling.ts`. Pedidos siempre ve la orden; Cocina, Mapa De Entregas y Repartidores la reciben únicamente cuando corresponde operativamente.

## Flujo de estados

Domicilio:

```text
PREPARING → PREPARED → READY → OUT_FOR_DELIVERY → ARRIVED → DELIVERED → COMPLETED
```

Recoger / Local:

```text
PREPARING → PREPARED → READY → COMPLETED
```

## Pagos y Caja

- `PENDING`: intención o medio previsto.
- `PAID`: dinero recibido.

Caja contabiliza únicamente pagos `PAID`.

## Consecutivo comercial

`Order.id` es técnico.

La identidad visible usa:

`Order.sequenceNumber + Order.source`

Ejemplos:

```text
POS-0001
POS-0002
WEB-0003
```

## Integraciones — pospuestas

Las integraciones de marketplace y otros proveedores externos no forman parte del código operativo activo.

La implementación experimental fue retirada.

**Las integraciones exclusivas de Alentó se mantienen separadas del criterio de cierre del núcleo genérico.**

## Autenticación y roles — primera versión implementada

Colaboradores:

- modelo `User`;
- roles múltiples;
- correo + contraseña;
- hash scrypt;
- cookie HttpOnly firmada;
- login/logout;
- bootstrap del primer ADMIN;
- pestaña `/usuarios`;
- navegación filtrada por rol;
- rutas internas protegidas;
- APIs internas principales protegidas.

Clientes:

- navegación pública y compra como invitado no requieren login;
- `/login` ofrece teléfono + OTP cuando la integración externa está configurada;
- `CustomerAccount` permanece separado de `Customer`;
- `/cuenta` muestra información privada del cliente autenticado.

Los modelos de autenticación ya forman parte del schema vigente. Cualquier sincronización de schema debe seguir la estrategia documentada en `docs/DEPLOYMENT.md`.

Ver `docs/AUTH_ROLES_AND_PUBLIC_APP.md`.

## Prisma

La base de producción no tiene baseline formal de Prisma Migrate.

El start actual todavía ejecuta `prisma db push`. Antes de producción estable debe realizarse backup + baseline y separar la evolución del schema del arranque normal.

No usar `prisma migrate deploy` sobre la base actual hasta realizar ese baseline.

La funcionalidad de pedidos programados añade `Order.scheduledFor` y su índice mediante `prisma/migrations/20261021170000_order_scheduling/migration.sql`. El arranque vigente de producción continúa usando `prisma db push`; no ejecutar `prisma migrate deploy` hasta completar el baseline documentado.

## Trabajo futuro

No asumir un siguiente módulo operativo sin una decisión explícita.

Pendientes estratégicos conocidos:

- endurecimiento futuro de autenticación: recuperación, auditoría y revocación inmediata de sesiones;
- cierre/conciliación avanzada de Caja;
- inventario;
- recetas;
- costos;
- rentabilidad;
- mejoras futuras de Menú: tipos de producto y modificadores;
- validación productiva de la experiencia pública ya implementada;
- sustitución de Glide donde todavía aplique;
- integraciones externas solo como extensiones opcionales.

## Experiencia pública — estado vigente 2026-09-23

La experiencia pública ya es una parte activa de Alentó App y comparte el mismo catálogo y las mismas estructuras comerciales del sistema interno.

Rutas públicas vigentes:

- `/`: Home publicitaria principal, aprobada, con slider hacia `/menu`.
- `/menu`: catálogo público responsive.
- `/cart`: carrito público.
- `/club`: Club Alentó, navegable como invitado y con saldo/movimientos para clientes autenticados.
- `/login`: acceso unificado; inicia en modo cliente por teléfono + OTP y permite cambiar a colaborador.
- `/cuenta`: perfil privado del cliente autenticado.
- `/seguimiento/[token]`: seguimiento del pedido mediante token firmado.

Rutas internas relacionadas:

- `/interno`: Punto de Venta.
- `/interno/menu`: administración del catálogo, solo ADMIN.
- `/personalizacion`: piezas visuales públicas, solo ADMIN.

### Home, menú, configurador y carrito

La Home usa imágenes independientes para móvil y escritorio administradas desde `/personalizacion`:

- móvil: `1080 × 2160 px`;
- escritorio: `1920 × 1080 px`.

El gesto de la Home entra a `/menu`.

El menú público consume `GET /api/catalog`, reutiliza categorías, productos, precios y orden reales, y usa una sola experiencia responsive negro/rojo/blanco. El hero configurable usa `1920 × 730 px`.

El configurador público ya soporta productos simples, pizzas de un sabor, pizzas de dos sabores, tamaños, bordes, extras cuando aplican y combos configurables. El carrito persiste en navegador.

La navegación pública persistente usa cuatro accesos: Menú, Carrito, Club y Perfil, en la parte inferior también en tablet y escritorio.

### Checkout público de domicilio

El carrito ya abre el paso de modalidad y domicilio mediante `PublicCheckoutDelivery`.

Comportamiento vigente:

- inicia por defecto en Recoger en tienda;
- Domicilio no reutiliza selecciones temporales de compras anteriores;
- la dirección guardada solo se consulta para un cliente autenticado y nunca bloquea el campo manual;
- si no hay sesión o la consulta falla, Google Places queda utilizable inmediatamente;
- el cliente puede escribir una dirección o solicitar explícitamente Mi ubicación;
- no se pinta ningún mapa hasta tener un destino validado;
- `POST /api/delivery/quote` calcula la ruta real server-side con Google Routes y aplica las bandas activas;
- el mapa dibuja la ruta sede → cliente y tiene formato `3:4`;
- Ruta, Domicilio y Tiempo están integrados como cabecera flotante dentro del mapa;
- fuera de cobertura no se puede confirmar Domicilio;
- el carrito muestra subtotal, domicilio y total provisional.

La creación final de pedidos públicos ya está implementada mediante `/api/public-checkout`.

El flujo actual crea `Order.source=WEB`, reutiliza el consecutivo global, vuelve a normalizar precios y configuraciones en servidor, recalcula domicilio con Google Routes cuando aplica, crea el pago inicial como `PENDING` y devuelve un enlace firmado de seguimiento.

`POST /api/orders` continúa reservado para el flujo interno del POS y crea `source=POS`.

Referencia: `docs/PUBLIC_CHECKOUT_MAPS.md`.

### Pedidos cancelados en la experiencia del cliente

Los pedidos `CANCELED` permanecen visibles tanto en `/cuenta` como en la ficha interna de `/clientes` para conservar trazabilidad y comportamiento histórico.

En la ficha interna del cliente:

- el historial incluye compras válidas y cancelaciones;
- los cancelados se resaltan visualmente;
- existe una métrica separada de cantidad y porcentaje de cancelaciones;
- esa métrica sirve para detectar clientes con patrones repetidos de cancelación;
- ticket promedio, total comprado, frecuencia y estado comercial se calculan solo con pedidos válidos, no cancelados.

En la experiencia pública del cliente:

Reglas vigentes:

- muestran una etiqueta visible **CANCELADO**;
- el total se presenta atenuado/tachado;
- se aclara que no cuentan como compra;
- no suman al total de compras válidas mostrado en Perfil;
- no generan ni conservan puntos Club Alentó.

Al cancelar desde operación, cualquier `ClubPointTransaction` ligado al pedido se elimina como protección adicional. Perfil y Club también ignoran movimientos históricos asociados a pedidos cancelados.

### Club Alentó

Club Alentó ya tiene persistencia y superficie pública.

Reglas predeterminadas vigentes:

- acumulación: 5% sobre subtotal elegible sin descuento;
- el domicilio no genera puntos;
- 1 punto equivale a $1 COP de valor de canje;
- compra mínima predeterminada para canje: $14.900;
- los puntos se acreditan cuando el pedido queda pagado y finalizado;
- un pedido acredita una sola vez;
- la tasa aplicada queda registrada en el movimiento.

Los movimientos viven en `ClubPointTransaction`. La UI de saldo e historial está implementada; el canje transaccional completo sigue pendiente.

### Seguimiento del cliente

Para clientes autenticados existe un indicador reutilizable de pedido activo en `/menu` y `/cart`.

Reglas vigentes:

- solo aparece si la sesión pertenece al cliente del pedido;
- muestra código, estado y una barra de 4 etapas adaptada a Domicilio o Recoger;
- se actualiza automáticamente mientras el pedido siga activo;
- enlaza a `/seguimiento/[token]`;
- al completar/cancelar el pedido deja de mostrarse como pedido activo;
- la página de seguimiento ofrece acciones para volver al menú y acceder a Cuenta/Login;
- el código visible respeta el origen real, por ejemplo `WEB-0020` o `POS-0020`.

Para invitados, el popup final recuerda que recibirán el enlace de seguimiento por mensaje y ofrece iniciar sesión para ver el pedido dentro de la app.

### Forma de pago en efectivo

El campo **¿Con cuánto pagas?** es opcional.

- si queda vacío, el pedido puede crearse normalmente con pago `PENDING`;
- si el cliente escribe un monto, debe ser igual o superior al total y se calculan las vueltas;
- `Pago exacto` continúa disponible como ayuda rápida.

### Repartidor y seguimiento

Los pedidos DELIVERY ya tienen relación explícita con `User` mediante `driverId` y `driverAssignedAt`.

Existe:

- listado de repartidores activos;
- asignación desde operación;
- notificación al repartidor por WhatsApp;
- enlace firmado de pedido;
- `/repartidor/pedido/[token]`;
- verificación obligatoria de productos antes de salir;
- transición `READY → OUT_FOR_DELIVERY`;
- transición `OUT_FOR_DELIVERY → ARRIVED`;
- autoactualización de la página del repartidor;
- seguimiento del cliente en `/seguimiento/[token]` con actualización automática.

La ubicación GPS en vivo del repartidor, las rutas y su representación sobre el mapa del cliente ya están implementadas.

## Pendientes inmediatos / mejora continua

La experiencia pública y el checkout WEB ya están implementados. Los pendientes actuales son de evolución y hardening:

1. mantener validación productiva continua en móvil/PWA/tablet/escritorio;
2. completar el canje transaccional de Club Alentó;
3. implementar refund/devoluciones auditables;
4. formalizar baseline Prisma y CI;
5. mejorar edición/selección de direcciones sin duplicar la fuente comercial;
6. mantener SEO, analítica y Push alineados con cambios de la experiencia pública.

## Caja

- Las salidas pueden eliminarse mientras la sesión de caja correspondiente siga abierta. Al cerrar caja, los movimientos quedan bloqueados.
- Nómina consume `WorkShift` pendientes, crea `PayrollPayment`, salida de Caja y descuentos de préstamos cuando aplican.
- El comprobante de nómina vive en `/caja/nomina/[id]/imprimir`.
- Si una salida de nómina se elimina con Caja abierta, la reversión devuelve turnos a pendientes y revierte descuentos de préstamo.
- Si se elimina un pago a repartidor con Caja abierta, el saldo vuelve a su cartera.

Documento canónico: `docs/PAYMENTS_AND_CASH.md`.
