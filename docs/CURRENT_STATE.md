# Estado actual del proyecto

Última actualización: 2026-10-27.

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
- Club acumula y muestra puntos, puede activarse/desactivarse desde administración y el canje transaccional sigue pendiente;
- los cupones disponen de visibilidad independiente por canal (`visibleInPos` / `visibleInCart`) y el checkout WEB los aplica server-side solo sobre productos elegibles;
- la navegación pública inferior responde visualmente desde el toque, usa prefetch/estados de carga y el carrito difiere la carga de mapa/checkout pesado hasta que el cliente continúa;
- `/masa`, notificaciones Meta/notifier y Chatwoot son extensiones exclusivas de Alentó, documentadas en `docs/ALENTO_EXCLUSIVE_MODULES.md`.

Pendientes de producción más importantes: backups/restauración, refund, hardening futuro de sesiones y decisión de alcance del canje Club. Baseline Prisma, CI y pruebas críticas ya están implementados.

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
- **Cupones** (`/cupones`): administración, métricas y visibilidad independiente en POS/Carrito. Documento: `docs/COUPONS.md`.
- **Club Puntos** (`/club-alento`): ranking, configuración de acumulación y switch maestro Activo/Inactivo. Documento: `docs/CLUB_POINTS.md`.
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
- cupones/descuentos con elegibilidad canónica y visibilidad de canal;
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

Ruta: `/interno/menu`

Capacidad vigente de imágenes:

- productos y combos conservan compatibilidad con URLs históricas;
- ADMIN puede cargar imagen principal/secundaria desde el dispositivo;
- la nueva imagen se guarda de forma persistente en PostgreSQL mediante `ProductImage`;
- al cargarla, `Product.imageUrl` / `imageUrl2` cambian a una ruta interna `/api/product-images/[id]`;
- la imagen cargada pasa a ser la fuente oficial inmediatamente;
- reemplazos internos eliminan la imagen anterior del mismo slot;
- formatos admitidos: JPG, PNG y WebP, máximo 8 MB;
- no se exponen campos de URL como flujo normal de administración.



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
- tipo `PIZZA_CUSTOM` para **Arma Tu Pizza**;
- asistente compartido cliente/POS: tamaño → borde → completa/mitad y mitad → ingredientes;
- cobro usando el precio real de cada `MODIFIER`; en mitad y mitad se cobra la mitad con más ingredientes y, en empate, la de mayor valor;
- subcategorías dinámicas de ingredientes mediante `IngredientGroup`, compartidas por administración y Arma Tu Pizza;
- validación y recálculo server-side del precio de Arma Tu Pizza;
- tarjeta pública de `PIZZA_CUSTOM` con referencia `Desde $14.900` calculada desde la pizza completa más económica; dentro del configurador el total permanece oculto hasta la primera selección de ingrediente;
- Cocina muestra `PIZZA_CUSTOM` con bloques separados para completa o Mitad 1 / Mitad 2 e ingredientes individualizados;
- Cocina usa máximo 2 pedidos por fila y **un producto por línea** dentro de cada pedido para mantener una lectura uniforme;
- Cocina ordena pedidos de más antiguo a más nuevo y marca visualmente el primero como `MÁS ANTIGUO`;
- tamaño y borde usan distintivos grandes independientes con icono, etiqueta y color propio;
- sabores/especialidades usan el mismo estilo de distintivo grande, con color estable por especialidad y tarjetas separadas para cada mitad en pizzas de dos sabores;
- en pizzas normales, Tamaño + Borde + Sabor comparten la misma fila visual; ingredientes de Arma Tu Pizza se muestran en mayúscula y con mayor legibilidad;
- factura térmica de `PIZZA_CUSTOM` usa la misma lectura operativa: tamaño/borde/forma y bloques separados de ingredientes;
- historial `/cuenta` y seguimiento público ocultan el cálculo interno de ingredientes de `PIZZA_CUSTOM`; muestran solo la selección y `Ingredientes: N`, contando ingredientes únicos entre ambas mitades;
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

La base de producción ya tiene baseline formal de Prisma Migrate: `20261026190500_baseline`.

El start actual ejecuta `prisma migrate deploy && next start -p 3000`.

Las migraciones históricas previas al baseline se conservan en `prisma/legacy-migrations/` como referencia técnica. Toda evolución nueva del schema debe crear una migración posterior al baseline.

Quality CI reconstruye PostgreSQL vacío con `prisma migrate deploy` y verifica cero drift contra `prisma/schema.prisma`.

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
- integraciones externas solo como extensiones opcionales.

## Experiencia pública — estado vigente 2026-10-26

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

La navegación pública persistente usa Menú, Carrito, Club y Perfil en la parte inferior también en tablet y escritorio. Club solo aparece cuando `club_alento_settings.enabled` está activo. El tab cambia visualmente desde `pointerdown`, las rutas principales se precargan y `/cart` / `/club` tienen estados de carga inmediatos. El carrito carga diferidamente los componentes pesados de Entrega y Datos/Pago.

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
- el carrito muestra subtotal, domicilio, descuento aplicable y total provisional;
- si existen cupones públicos aplicables, se seleccionan en el paso Entrega/Totales, uno por fila y a ancho completo;
- si todo el carrito está en promoción/no elegible, no se muestran cupones y se informa que la compra no aplica;
- si el carrito mezcla promociones y productos elegibles, se aclara que el cupón solo afecta la base elegible;
- la pantalla Tus datos no repite la selección ni el descuento del cupón; recibe el total ya descontado.

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

Club Alentó ya tiene persistencia, superficie pública y un interruptor maestro administrable desde `/club-alento`.

Cuando está desactivado:

- desaparece de la navegación pública;
- `/club` redirige a `/menu`;
- no se acreditan puntos nuevos;
- saldos y movimientos históricos permanecen intactos.

Al reactivarlo, vuelve a mostrarse y continúa con los saldos existentes.

Configuración y reglas vigentes:

- acumulación configurable desde administración; el fallback inicial del código es 5% sobre subtotal elegible sin descuento;
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
3. cerrar validación productiva del refund auditable después del hotfix de consistencia #10;
4. mantener baseline Prisma/migraciones y pruebas automatizadas críticas alineadas;
5. mejorar edición/selección de direcciones sin duplicar la fuente comercial;
6. mantener SEO, analítica y Push alineados con cambios de la experiencia pública.

## Caja

- Las salidas pueden eliminarse mientras la sesión de caja correspondiente siga abierta. Al cerrar caja, los movimientos quedan bloqueados.
- Nómina consume `WorkShift` pendientes, crea `PayrollPayment`, salida de Caja y descuentos de préstamos cuando aplican.
- El comprobante de nómina vive en `/caja/nomina/[id]/imprimir`.
- Si una salida de nómina se elimina con Caja abierta, la reversión devuelve turnos a pendientes y revierte descuentos de préstamo.
- Si se elimina un pago a repartidor con Caja abierta, el saldo vuelve a su cartera.

Documento canónico: `docs/PAYMENTS_AND_CASH.md`.


## Cambios consolidados — 2026-10-26

- `Coupon` incorpora `visibleInPos` y `visibleInCart`; POS y WEB validan el canal también en servidor.
- `POST /api/public-checkout/eligibility` es la ruta pública segura para calcular base elegible; no reutilizar `/api/discount/eligibility` desde la app cliente.
- POS y WEB comparten `normalizeOrderLine` para elegibilidad de cupones, incluidas pizzas configuradas y Arma Tu Pizza.
- el cupón público se elige antes de Datos/Pago y nunca descuenta domicilio.
- productos promocionales/no acumulables quedan fuera de la base del cupón.
- Club Puntos tiene `enabled` como interruptor maestro; apagarlo no borra puntos ni interrumpe otros efectos de `COMPLETED`.
- `/club` consulta sesión/configuración en paralelo y reduce refrescos en segundo plano; invitados ya no refrescan la página completa cada 8 s.
- `/cart` usa `dynamic()` para cargar `PublicCheckoutDelivery` y `PublicCheckoutCustomer` solo cuando se requieren.
- el arranque productivo ya no ejecuta backfills históricos en cada redeploy.


## Calidad automática — 2026-10-26

El repositorio ya cuenta con CI permanente en `.github/workflows/quality-ci.yml`.

Cada push a `main` y cada pull request valida en GitHub Actions:

- instalación reproducible mediante `npm ci`;
- `prisma validate`;
- aplicación de migraciones mediante `prisma migrate deploy` sobre PostgreSQL 16 efímero;
- verificación de cero drift contra `prisma/schema.prisma`;
- ESLint;
- TypeScript con `tsc --noEmit`;
- Vitest mediante `npm test`;
- `next build`.

La primera ejecución detectó tres errores de lint en scripts históricos CommonJS. Se corrigió la configuración de ESLint sin cambiar el comportamiento de esos scripts.

La suite automatizada ya está implementada con Vitest:

- 6 archivos de pruebas;
- 35 tests;
- Club Puntos;
- programación/ventanas de pedidos;
- domicilio/cobertura;
- flujo y códigos;
- normalización canónica de precios, incluida Arma Tu Pizza.

La corrida final del Quality CI terminó completamente verde. Las pruebas E2E de navegador siguen pendientes como evolución futura.


## Backups y recuperación — 2026-10-26

El hardening de backup ya está implementado y probado de extremo a extremo.

Política:

- RPO objetivo: 1 hora;
- RTO objetivo: 2 horas;
- backup horario remoto en Google Drive, retención 48;
- backup diario remoto en Google Drive, retención 30;
- restauración de prueba mensual en base separada.

Validación real realizada:

- backup horario y diario generados correctamente;
- archivos .sql.gz confirmados fuera del VPS;
- restore ejecutado sobre PostgreSQL temporal;
- prisma migrate status correcto;
- npm run db:verify-restore devolvió Database restore verification: OK;
- se leyeron correctamente clientes, usuarios, productos, pedidos, pagos, configuración, Caja, Club, turnos y migraciones;
- servicio temporal eliminado después de validar.

Documento canónico: docs/BACKUPS_AND_RECOVERY.md.

El siguiente punto de hardening es seguridad de sesiones y rate limiting, pendiente de autorización explícita del usuario.


## Seguridad de sesiones y rate limiting — 2026-10-27

El hardening #6 está implementado y validado en producción.

Cambios principales:

- `User.sessionVersion` permite revocación central por colaborador;
- desactivar usuario o cambiar correo, contraseña, roles o permisos invalida sesiones anteriores;
- middleware Node.js consulta PostgreSQL y autoriza con roles vigentes;
- cookies staff legacy se migran silenciosamente a versión revocable;
- `getStaffSession` y `getCustomerSession` vuelven a validar estado actual en DB;
- `SecurityRateLimit` persiste buckets en PostgreSQL;
- IP/email/teléfono se almacenan como HMAC, no en texto plano;
- login, bootstrap, OTP, Delivery Quote, elegibilidad y creación WEB tienen límites de abuso;
- HTTP 429 incluye `Retry-After`.

Migración:

`20261027022000_security_sessions_rate_limits`

Quality CI:

- migrate deploy: verde;
- cero drift;
- lint/types: verde;
- 6 archivos / 35 tests;
- build: verde.

Documento canónico:

`docs/SECURITY_HARDENING.md`.

Validación productiva completada: redeploy correcto, migraciones aplicadas, Next.js operativo y revocación inmediata confirmada con una sesión independiente de colaborador no ADMIN.

El siguiente punto pendiente es #7 Idempotencia de operaciones críticas.


## Idempotencia de operaciones críticas — 2026-10-27

El hardening #7 está implementado y validado en producción.

Cambios principales:

- pedidos POS y WEB exigen `Idempotency-Key`;
- registro de pagos exige `Idempotency-Key`;
- navegador reutiliza la misma clave durante retry del mismo intento;
- `Order` y `Payment` almacenan clave única + hash canónico;
- pedidos usan advisory lock PostgreSQL por clave;
- pagos usan row lock del pedido y recalculan saldo dentro de la transacción;
- un replay devuelve el recurso existente y no repite notificaciones;
- mismo key con request diferente devuelve 409;
- request crítico sin key devuelve 428.

Migración:

`20261027030000_order_payment_idempotency`

Quality CI:

- migrate deploy: verde;
- cero drift;
- lint/types: verde;
- **8 archivos / 43 tests**;
- prueba concurrente de pagos: verde;
- build: verde;
- workflow `40439799102`.

Documento canónico:

`docs/IDEMPOTENCY.md`.

Validación productiva completada: pedido POS, pedido WEB, registro de pagos y eliminación de pagos funcionaron con normalidad después del hotfix del advisory lock.

El siguiente punto pendiente es #8 Audit Log.


### Hotfix productivo del advisory lock — 2026-10-27

Durante la primera prueba POS del punto #7, Prisma rechazó el retorno `void` de `pg_advisory_xact_lock()`.

Se corrigió `lockIdempotencyKey()` para ejecutar el lock mediante un CTE materializado y devolver únicamente `1::int` a Prisma.

Se añadió una prueba de integración específica contra PostgreSQL.

Quality CI del hotfix:

- run `40596132160`;
- cero drift;
- lint verde;
- TypeScript verde;
- **44 tests verdes**;
- build verde.

Estado #7: ✅ completado. Hotfix redeployado y validado en producción.


## Audit Log central — 2026-10-27

El hardening #8 está **implementado y validado en producción**.

Arquitectura:

- tabla central `AuditLog`;
- append-only protegido mediante trigger PostgreSQL;
- actor snapshot sin FK;
- before/after/metadata JSON sanitizados;
- helper canónico `src/lib/auditLog.ts`;
- escritura transaccional junto con la operación sensible;
- pantalla ADMIN `/auditoria`;
- API ADMIN de solo lectura;
- presentación visible en español Colombia mediante `src/lib/auditPresentation.ts`.

Cobertura:

- usuarios/roles;
- pedidos y estados;
- transición automática Cocina → Horneando;
- transiciones del Repartidor;
- descuentos POS/WEB;
- pagos;
- Caja;
- ingresos/salidas;
- préstamos/abonos;
- nómina;
- pagos a repartidores;
- cupones;
- configuración POS/Club/home/tracking.

Migración:

`20261027224500_central_audit_log`

Validación productiva real:

- `/auditoria` cargó correctamente con sesión ADMIN;
- pedido comercial #801 registró **Horneando → Listo**;
- se confirmó actor, fecha, entidad y origen;
- se registró pago real de **$14.900 COP en Efectivo**;
- Pedidos y Pagos continuaron operativos.

Regla de idioma del producto:

- UI pública e interna: español Colombia (`es-CO`);
- fechas operativas: Bogotá (`America/Bogota`);
- valores visibles: COP;
- códigos/enums persistidos pueden mantenerse en inglés;
- nunca traducir valores técnicos persistidos solo para mostrar una etiqueta;
- usar una capa de presentación compartida.

Documento canónico:

`docs/AUDIT_LOG.md`.

CI final del #8: `40605413080` — 10 archivos / 51 tests, cero drift y build verde.

Estado #8: ✅ completado.

El hardening #9 Observabilidad está implementado y validado en producción.


## Sidebar interno compacto — 2026-10-27

Durante la validación visual del Audit Log se ajustó el menú interno de escritorio/tablet:

- menor altura del encabezado;
- módulos más compactos verticalmente;
- iconos y tipografía ligeramente reducidos;
- bloque de usuario más corto;
- estado ABIERTA/CERRADA reubicado para aprovechar el espacio;
- el control hamburguesa del sidebar de escritorio fue reemplazado por:
  - flecha izquierda al recoger;
  - flecha derecha al expandir;
- se conserva scroll como respaldo únicamente para alturas reducidas;
- el drawer móvil/tablet también recibió una compactación ligera.

Archivos:

- `src/components/AppShell.tsx`;
- `src/components/StaffStoreStatus.tsx`.

Quality CI:

- run `40601840078`: success.


### Hotfix de cobertura de estados en Audit Log — 2026-10-27

Durante la primera validación productiva del #8, un pedido pasó a **Horneando** pero la pantalla de Auditoría permaneció en 0.

Causa confirmada:

- `PREPARED` puede ser asignado automáticamente por Cocina cuando todas las líneas quedan preparadas;
- ese flujo usa `/api/orders/[id]/items/[itemId]/prepared` y actualizaba `Order.status` directamente;
- el endpoint general `/api/orders/[id]/status` sí estaba auditado, pero no era el único camino de transición.

Corrección:

- Cocina → `PREPARED` registra `ORDER_STATUS_CHANGED` dentro de la misma transacción;
- transiciones desde Repartidor también registran `ORDER_STATUS_CHANGED`;
- metadata identifica el origen de transición;
- la validación posterior confirmó registros reales en producción.

Estado #8: ✅ completado.


## Observabilidad de producción — 2026-10-27

El hardening #9 está **implementado y validado en producción**.

Capacidades:

- request ID server-side por solicitud;
- header `X-Request-Id`;
- logs JSON estructurados;
- incidentes operativos agregados por fingerprint;
- captura de errores frontend;
- captura de errores backend no controlados;
- health check con latencia PostgreSQL;
- pantalla ADMIN `/salud-sistema`;
- alertas activas/resueltas;
- resolución manual con reapertura automática;
- monitoreo de Notifier, Web Push, Google Maps, jobs y webhooks;
- prueba segura end-to-end desde la UI.

Modelo:

`OperationalIncident`

Migración:

`20261028001500_observability_operational_incidents`

Validación productiva real:

- estado inicial: Sistema operativo;
- PostgreSQL, Notifier, Web Push, Google Maps y Jobs: Operativos;
- 0 errores activos;
- 0 advertencias activas;
- 0 jobs fallidos en 24 h;
- alerta segura generada correctamente;
- estado cambió a Operativo con alertas;
- advertencias activas: 1;
- alerta visible con categoría Sistema y diagnóstico;
- alerta marcada como resuelta;
- sistema volvió a 0 advertencias;
- alerta visible en resueltas recientemente.

Backups:

`db:verify-restore` incluye `operationalIncidents`.

Quality CI final:

- migración aplicada;
- cero drift;
- lint/types verdes;
- **11 archivos / 54 tests**;
- build verde;
- run `40610330977`.

Documento canónico:

`docs/OBSERVABILITY.md`.

Estado #9: ✅ completado.

El siguiente punto es #10 Refund / devoluciones auditables y no debe iniciarse sin autorización explícita del usuario.


## Pedidos programados y fecha efectiva de venta — 2026-10-27

Antes de iniciar el hardening #10 se detectó una inconsistencia contable:

- un pedido creado el 27/10 pero programado para el 31/10 aparecía dentro de Ventas del 27/10;
- esto mezclaba fecha de creación con fecha real de servicio/venta.

Regla implementada:

- pedido inmediato: fecha efectiva = `createdAt`;
- pedido programado: fecha efectiva = `scheduledFor`.

Caja:

- Ventas usa fecha efectiva de venta;
- Cobros de ventas sigue usando `Payment.paidAt`;
- Entradas/Salidas mantienen sus fechas reales;
- un pedido programado puede aparecer como Venta de una fecha futura sin significar que ya ingresó dinero;
- el detalle de Ventas muestra la fecha programada y, como referencia secundaria, cuándo fue creado.

Protección operativa:

- el pedido futuro permanece visible en Pedidos;
- la tarjeta se presenta como **PROGRAMADO** mientras esté fuera de su ventana operativa;
- cobro real bloqueado antes de la fecha programada;
- creación y eliminación de movimientos de pago protegidas también en backend;
- cambios de estado y asignación de repartidor continúan bloqueados hasta 30 minutos antes;
- Cocina no recibe el pedido antes de esa ventana;
- consultar, editar, reprogramar, imprimir o cancelar siguen disponibles antes de la ventana.

Analítica de zonas de domicilio también atribuye pedidos programados a `scheduledFor`.

Fuente compartida:

`src/lib/orderScheduling.ts`

Pruebas añadidas:

- fecha Bogotá;
- detección de pedido programado para otro día;
- fecha comercial de pedido programado.

Quality CI: `40614116593` — 11 archivos / 56 tests, cero drift y build verde.

Estado: ✅ redeploy y validación productiva confirmados por el usuario; #10 autorizado.


## Devoluciones auditables — hardening #10

Implementado en `main` mediante PR #6. Quality CI `40615841655`: ✅ success. Redeploy en EasyPanel confirmado. Pendiente validación productiva.

- `PaymentRefund` persiste devoluciones parciales/totales sin borrar el cobro original;
- endpoint idempotente de refund;
- Audit Log `PAYMENT_REFUNDED`;
- Caja distingue cobros, gastos y devoluciones;
- el cobro permanece atribuido a `paidAt` y la devolución a `refundedAt`;
- flujo neto y cierre esperado descuentan devoluciones;
- saldo y edición de pedido usan dinero neto recibido;
- cancelación de un pedido cobrado exige neto recibido = 0;
- un pago que ya tenga devoluciones queda protegido contra eliminación física;
- Pedidos muestra acción de devolución e historial asociado.

Documento canónico: `docs/PAYMENTS_AND_CASH.md`.


## Revisión de consistencia de refunds — 2026-10-27

Antes de ejecutar la validación productiva final del hardening #10 se revisó el sistema de extremo a extremo. La implementación base ya estaba desplegada, pero se encontraron consumidores heredados que todavía trataban `PAID` como dinero bruto sin considerar devoluciones o filtraban el historial según el estado posterior del pedido.

Las correcciones están agrupadas en PR #7 e incluyen Caja/cierre, permisos CASHIER, finalización de pedidos, recálculos y replays de pagos, eliminación definitiva, estadísticas de medios y verificación de restore. La validación real del #10 debe hacerse únicamente después de merge/redeploy de ese hotfix.


## Borrador POS y acceso WhatsApp — 2026-11-14

El POS conserva localmente el pedido en construcción, sus configuraciones y el contexto de pantalla al navegar entre módulos; limpia el borrador al crear el pedido. Las superficies internas incluyen un acceso flotante a WhatsApp Web que abre una ventana independiente para autenticación por QR. Alcance y limitaciones: `docs/POS_DRAFT_AND_WHATSAPP.md`.
\n\n## Bandeja de WhatsApp dentro de Alentó — 2026-11-14\n\nSe reemplazó el acceso flotante que abría WhatsApp Web en otra ventana por el módulo interno `/mensajes`. La bandeja consume Chatwoot desde endpoints de servidor protegidos por sesión y roles internos; lista conversaciones abiertas, pendientes y resueltas, muestra historial y permite enviar texto. La activación requiere las variables CHATWOOT_BASE_URL, CHATWOOT_ACCOUNT_ID, CHATWOOT_WHATSAPP_INBOX_ID y CHATWOOT_API_ACCESS_TOKEN en EasyPanel. No es un iframe de WhatsApp Web; es interfaz propia de Alentó sobre el API de Chatwoot. Alcance pendiente de ampliar: adjuntos, notas de voz, asignación y acciones de estado.