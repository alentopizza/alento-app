# Estado actual del proyecto

Última actualización: 2026-09-22.

Este documento resume el comportamiento vigente de Alentó App y es una de las primeras referencias que debe leer una persona o IA al retomar el proyecto.

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

Integraciones externas permanecen pospuestas y deben abordarse al final del desarrollo.

## Infraestructura

- Next.js 15 + React 19 + TypeScript.
- Tailwind CSS 4.
- Prisma 6 + PostgreSQL.
- EasyPanel/VPS.
- Proyecto EasyPanel: `app_alento`.
- Servicio: `alento-app`.
- Base: `alento-db`.
- URL temporal: `https://pos.alentopizza.com/`.

`alentopizza.com` continúa servido por Glide mientras se completa la migración futura.

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

Rappi, DiDi y otras integraciones externas no forman parte del código operativo activo.

La implementación experimental fue retirada.

**Integraciones permanece reservada para la última fase del desarrollo.**

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

- navegación pública futura no requiere login;
- `/cuenta/login` usa teléfono + OTP por WhatsApp;
- `CustomerAccount` permanece separado de `Customer`;
- `/cuenta` muestra información privada del cliente autenticado.

Este bloque requiere `npx prisma db push` y variables de entorno nuevas.

Ver `docs/AUTH_ROLES_AND_PUBLIC_APP.md`.

## Prisma

La base de producción no tiene baseline formal de Prisma Migrate.

Cuando cambie el schema:

```bash
npx prisma db push
```

No usar `prisma migrate deploy` hasta realizar baseline.

El cierre documental de los cinco módulos no requiere un cambio de schema.

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
- experiencia pública;
- sustitución de Glide;
- integraciones externas como última fase.

## Experiencia pública — estado vigente 2026-09-22

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

La creación final de un pedido WEB todavía no está implementada. `POST /api/orders` continúa siendo el flujo interno del POS y crea `source=POS`. No reutilizarlo directamente desde el navegador público sin completar la fase de checkout seguro.

Referencia: `docs/PUBLIC_CHECKOUT_MAPS.md`.

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

La ubicación GPS en vivo del repartidor y su representación sobre el mapa del cliente siguen siendo futuras.

## Pendientes inmediatos de la experiencia pública

1. Validar en producción el checkout 3:4, Google Places, GPS opcional y Routes.
2. Completar persistencia enriquecida de `CustomerAddress` con placeId y coordenadas.
3. Completar identidad/cliente, pago, recálculo final y creación segura de pedidos `source=WEB`.
4. Conectar el pedido WEB al seguimiento y notificaciones existentes.
5. Mantener la lógica comercial única: no duplicar catálogo, configuradores, tarifas ni normalización de pedidos.
