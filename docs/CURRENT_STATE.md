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

Todavía no existe autenticación ni autorización por roles.

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

Ruta: `/`

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

## Autenticación y roles — pendiente estratégico

Actualmente no existe:

- modelo `User`;
- login;
- hash de contraseña;
- sesión;
- middleware de protección;
- autorización por rol;
- protección completa de APIs internas.

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

- autenticación y roles;
- cierre/conciliación avanzada de Caja;
- inventario;
- recetas;
- costos;
- rentabilidad;
- mejoras futuras de Menú: tipos de producto y modificadores;
- experiencia pública;
- sustitución de Glide;
- integraciones externas como última fase.
