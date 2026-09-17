# Arquitectura de Alentó App

Este documento describe la arquitectura actual y las decisiones que deben respetarse al continuar el desarrollo.

## Objetivo

Alentó App es la plataforma operativa y comercial de Alentó Pizza. Debe centralizar:

- POS;
- catálogo;
- clientes;
- pedidos;
- Cocina;
- pagos;
- Caja;
- cupones;
- configuración;
- futura app pública;
- futuras recetas, inventario, costos e integraciones.

La plataforma debe poder adaptarse a otros restaurantes sin reescribir su núcleo.

## Stack

- Next.js 15.
- React 19.
- TypeScript.
- Tailwind CSS 4.
- Prisma 6.
- PostgreSQL.
- EasyPanel/VPS.

## Infraestructura actual

- Proyecto EasyPanel: `app_alento`.
- Servicio web: `alento-app`.
- PostgreSQL: `alento-db`.
- Acceso temporal actual: `pos.alentopizza.com`.
- `alentopizza.com` continúa ocupado por Glide durante la transición.

## Arquitectura objetivo de dominio

La decisión de producto es utilizar un solo dominio principal.

Objetivo:

```text
alentopizza.com/
├── experiencia pública
├── menú
├── carrito
├── checkout
└── seguimiento

alentopizza.com/interno
├── login
├── POS
├── Pedidos
├── Cocina
├── Clientes
├── Caja
├── Menú administrativo
├── Cupones
└── Configuración
```

No diseñar módulos internos suponiendo que cada uno necesita un dominio propio.

## Separación público / interno

El contenido público y el sistema interno pueden vivir en la misma aplicación Next.js, pero deben tener responsabilidades y permisos claramente separados.

La experiencia pública podrá consumir catálogo, precios, cobertura y creación de pedidos autorizada.

El sistema interno deberá requerir sesión y rol para páginas y APIs.

Ver `docs/AUTH_ROLES_AND_PUBLIC_APP.md`.

## Clientes vs usuarios internos

`Customer` representa a quien compra.

Los empleados deben usar un modelo independiente (`User`) y nunca reutilizar `Customer` como cuenta administrativa.

La autenticación todavía no está implementada.

## Roles objetivo iniciales

- `ADMIN`
- `POS`
- `KITCHEN`
- `CASHIER`
- `DISPATCH`

La autorización debe validarse en servidor, no solo ocultando elementos de UI.

## Módulos actuales

### `/`

Actualmente funciona como POS durante la fase de construcción.

A futuro, cuando se sustituya Glide, `/` será candidato natural para la experiencia pública y el POS podrá moverse bajo `/interno`.

No realizar este movimiento masivamente hasta que autenticación y rutas internas estén preparadas.

### `/pedidos`

Dashboard operativo de pedidos, pagos, edición, impresión y acciones de estado.

### `/cocina`

Preparación por cantidades y transición `PREPARING → PREPARED → READY`.

### `/caja`

Debe representar dinero efectivamente recibido, no simplemente pedidos creados.

### `/clientes`

Gestión de clientes comerciales.

### `/menu`

Administración del catálogo.

### `/cupones`

Administración de descuentos reutilizables.

### `/configuracion`

Tarifas, medios de pago y configuración operativa.

### `/pedidos/[id]/imprimir`

Comprobante operativo térmico 80 mm.

## Principio crítico: configuración estructurada

Cada orden debe conservar exactamente qué se vendió.

`OrderItem.configuration` es la fuente estructurada para pizzas, combos y futuras recetas/costos.

Nunca reconstruir inventario o costos desde texto visible del ticket.

Ver `docs/ORDER_DATA_INTEGRITY.md`.

## Creación de pedidos

`POST /api/orders` es la entrada principal del POS.

Debe:

- validar modalidad;
- validar cliente/dirección cuando aplique;
- validar zona;
- validar medio de pago seleccionado;
- validar configuración estructurada;
- recalcular precios;
- aplicar descuentos;
- crear pedido y líneas de forma transaccional;
- asignar consecutivo comercial global;
- crear pago inicial como pendiente cuando corresponda.

Los pedidos nuevos nacen directamente en `PREPARING`.

## Consecutivo comercial

`Order.id` es técnico.

`Order.sequenceNumber` es el número comercial compartido por todos los canales.

`OrderSequence.current` mantiene el contador global.

Ejemplo:

```text
POS-0001
WEB-0002
POS-0003
```

El prefijo proviene de `Order.source` y el número nunca se separa por canal.

Ver `docs/ORDER_NUMBERING.md`.

## Flujo de estados

### Domicilio

```text
PREPARING
→ PREPARED
→ READY
→ OUT_FOR_DELIVERY
→ ARRIVED
→ DELIVERED
→ COMPLETED
```

### Recoger / Local

```text
PREPARING
→ PREPARED
→ READY
→ COMPLETED
```

Cocina es responsable de `PREPARING`, `PREPARED` y el paso a `READY`.

Pedidos gestiona las etapas posteriores a `READY`.

## Pagos

Un medio de pago seleccionado no equivale a ingreso recibido.

`Payment.status = PAID` y `paidAt` representan un ingreso real.

Caja debe sumar únicamente pagos realmente recibidos.

Eliminar un pago ingresado por error es un borrado físico y debe sacarlo de Caja.

Ver `docs/PAYMENTS_AND_CASH.md`.

## Edición de pedidos

La edición debe preservar la integridad estructurada.

Actualmente se permite modificar modalidad, tarifa, cantidades y agregar productos simples. Si la modificación afecta trabajo ya iniciado, la orden puede regresar a `PREPARING`.

La futura edición completa de pizzas/combos debe reutilizar los mismos configuradores estructurados del POS.

## Eliminación y cancelación

Cancelar conserva trazabilidad con estado `CANCELED`.

Eliminar borra físicamente el pedido y sus dependencias. El backend elimina pagos y líneas antes de la orden dentro de una transacción.

Estas dos acciones no deben confundirse.

## App pública futura

La futura experiencia tipo app de delivery debe reutilizar el mismo motor de negocio.

No crear un segundo sistema de catálogo/pedidos para la web.

Los pedidos públicos usarán:

```text
source = WEB
```

y consumirán el mismo consecutivo global que POS.

## Integraciones

Chatwoot debe actuar como canal de atención, no como un segundo motor de pedidos.

Cualquier integración futura debe terminar utilizando las mismas reglas comerciales y el mismo modelo de Order.

## Portabilidad

Para que el proyecto pueda replicarse o comercializarse, separar siempre:

### Núcleo reutilizable

- motor de pedidos;
- estados;
- configuración estructurada;
- pagos;
- permisos;
- inventario/costos futuros;
- interfaces operativas.

### Configuración por negocio

- marca;
- logos;
- colores;
- catálogo;
- precios;
- tarifas;
- medios de pago;
- usuarios;
- dominio;
- secretos e infraestructura.

La arquitectura actual es una instalación por negocio. No introducir multi-tenancy sin una decisión explícita y un diseño separado.

## Seguridad pendiente

Antes de mover `alentopizza.com` a Alentó App deben existir:

- usuarios internos;
- hash de contraseñas;
- login/logout;
- sesiones seguras;
- páginas internas protegidas;
- APIs internas protegidas;
- permisos por rol;
- administración de usuarios;
- configuración correcta de cookies/secrets en producción.

## Base de datos y despliegue

Producción no tiene baseline formal de Prisma Migrate.

Para cambios de schema se usa:

```bash
npx prisma db push
```

No usar `prisma migrate deploy` hasta realizar baseline.

`db push` no ejecuta SQL personalizado existente únicamente dentro de migraciones. Evitar que lógica crítica dependa de triggers no instalados.

## Documentación relacionada

- `docs/CURRENT_STATE.md`
- `docs/AUTH_ROLES_AND_PUBLIC_APP.md`
- `docs/ORDER_DATA_INTEGRITY.md`
- `docs/ORDER_NUMBERING.md`
- `docs/PAYMENTS_AND_CASH.md`
- `docs/ORDERS.md`
- `docs/DEPLOYMENT.md`
- `docs/HANDOFF.md`
