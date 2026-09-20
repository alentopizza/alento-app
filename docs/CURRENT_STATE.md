# Estado actual del proyecto

Última actualización: 2026-09-20.

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


## App pública de clientes — V1 iniciada

Ruta pública principal:

`/`

Alias temporal compatible:

`/app`

La primera versión ya consume `GET /api/catalog` y permite navegar sin autenticación.

Incluye:

- identidad visual Alentó;
- acceso opcional a Cuenta;
- buscador público;
- categorías reales;
- orden real del catálogo;
- destacados reales;
- imágenes reales;
- precios calculados desde los datos existentes;
- tarjetas de producto;
- modal de detalle;
- navegación inferior;
- acceso a Pedidos/Cuenta mediante la sesión de cliente existente.

La raíz `/` es ahora la experiencia pública principal. El POS interno se encuentra en `/interno` y permanece protegido por sesión y roles.

El carrito/configurador público todavía no está conectado. Debe reutilizar la misma estructura comercial del POS para pizzas, dos sabores y combos, evitando implementar precios o configuraciones paralelas.


## Navegación principal y acceso unificado

Desde 2026-09-20:

- `/` muestra la experiencia pública de Alentó;
- `/app` se conserva como alias temporal de la misma experiencia;
- `/interno` es la ruta protegida del Punto de Venta;
- `/login` y `/cuenta/login` muestran el mismo acceso unificado;
- el modo inicial es Cliente por teléfono + OTP;
- el botón `Iniciar como colaborador` cambia al acceso por correo + contraseña;
- después del login de colaborador, la navegación se resuelve por roles y permisos.


## Personalización de portada pública

Ruta administrativa:

`/personalizacion`

Solo disponible para `ADMIN`.

Permite administrar dos piezas promocionales de la experiencia pública:

- Banner principal: formato recomendado `1200 × 625 px` (~1.92:1).
- Banner secundario: formato recomendado `1200 × 310 px` (~3.9:1).

Cada banner puede:

- activarse o desactivarse;
- cargar una imagen JPG/PNG/WebP;
- recortarse automáticamente al formato objetivo;
- convertirse a WebP en el navegador;
- vincularse a un producto activo y visible del catálogo;
- abrir el producto vinculado al tocar el banner en la portada.

La configuración se persiste en `AppSetting` con clave `public.home`.

No requiere cambios de Prisma ni `npx prisma db push`.


### Logo de portada y composición visual

Personalización también permite cargar el logo usado en la cabecera de la experiencia pública.

Formato recomendado:

- Logo de portada: `600 × 180 px` (3.33:1), preferiblemente con fondo transparente.
- Banner principal: `1200 × 625 px` (~1.92:1).
- Banner secundario: `1200 × 310 px` (~3.9:1).

El logo se ajusta completo con `object-contain`, sin recorte ni deformación.

La portada pública sigue esta jerarquía visual:

`cabecera → buscador → banner principal → categorías → populares → banner secundario → menú completo`

La navegación inferior usa cinco accesos visuales: Inicio, Menú, Pedir, Ofertas y Cuenta.

La configuración ya guardada de banners sigue siendo compatible; agregar el logo no requiere recrear las piezas existentes.


## Promoción de App 2 a experiencia principal

Desde 2026-09-20 la variante aprobada como App 2 pasa a ser la experiencia pública principal:

- `/`: nueva pantalla inicial publicitaria con imagen 1:2 y slider de acceso;
- `/pedir`: segunda pantalla del nuevo diseño con catálogo, búsqueda y categorías;
- `/app2`: conserva la versión pública anterior para comparación temporal;
- `/app`: se mantiene temporalmente como alias de la versión anterior para no romper enlaces existentes;
- la PWA instalada inicia en `/`.

El POS interno continúa en `/interno`.


## Imágenes responsivas del Home principal

La sección `/personalizacion` permite administrar dos imágenes independientes para la pantalla inicial de `/`:

- móvil: `1080 × 2160 px` (1:2);
- escritorio/PC: `1920 × 1080 px` (16:9).

La portada selecciona automáticamente la imagen de escritorio a partir de 900 px de ancho y usa la pieza móvil por debajo de ese punto.

Si no existe una imagen configurada, se conserva la pieza histórica del Home como respaldo. La configuración se guarda en `AppSetting(public.home)`; no requiere cambios de Prisma.
