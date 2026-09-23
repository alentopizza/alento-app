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
- experiencia pública;
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

Los empleados usan un modelo independiente (`User`) y nunca reutilizan `Customer` como cuenta administrativa.

La primera versión de autenticación ya está implementada:

- colaboradores: correo + contraseña;
- clientes: teléfono + OTP de WhatsApp;
- cookies de sesión separadas;
- roles internos múltiples;
- middleware de protección;
- administración de usuarios en `/usuarios`.

## Roles objetivo iniciales

- `ADMIN`
- `POS`
- `KITCHEN`
- `CASHIER`
- `DRIVER`

La autorización debe validarse en servidor, no solo ocultando elementos de UI.

## Módulos actuales

### `/`

Home pública principal. Si existe sesión de colaborador, redirige a la superficie interna permitida por sus roles.

### `/menu`

Catálogo público oficial y configurador.

### `/cart`

Carrito público y entrada al selector de modalidad/domicilio.

### `/club`

Club Alentó para invitados y clientes autenticados.

### `/login`

Acceso unificado cliente/colaborador.

### `/cuenta`

Información privada del cliente autenticado.

### `/seguimiento/[token]`

Seguimiento público firmado de un pedido.

### `/interno`

Punto de Venta protegido para ADMIN, POS y CASHIER.

### `/interno/menu`

Administración interna del catálogo, solo ADMIN.

### `/pedidos`

Dashboard operativo de pedidos, pagos, edición, impresión y asignación de repartidor.

### `/cocina`

Preparación por cantidades y transición PREPARING → PREPARED → READY.

### `/caja`

Dinero efectivamente recibido.

### `/clientes`

Gestión comercial de clientes.

### `/cupones`

Administración de descuentos.

### `/configuracion`

Configuración operativa, tarifas, medios de pago y sede.

### `/personalizacion`

Configuración visual pública, solo ADMIN.

### `/usuarios`

Administración de colaboradores, roles y permisos, solo ADMIN.

### `/repartidor/pedido/[token]`

Superficie firmada del repartidor para verificar el pedido e informar salida/llegada.

### `/pedidos/[id]/imprimir`

Comprobante térmico 80 mm.

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

## Experiencia pública

La experiencia pública ya existe y debe seguir reutilizando el mismo motor comercial.

Actualmente están implementados Home, menú, configurador, carrito, Club y el paso de domicilio con Google Maps/Routes.

El checkout público todavía no crea la orden final. La fase pendiente debe crear `Order.source=WEB`, usar el consecutivo global y reutilizar normalización, precios, cobertura y configuración estructurada existentes.

No exponer `POST /api/orders` tal como está al navegador público: hoy es un endpoint interno protegido y fija `source=POS`. La creación WEB necesita un contrato público específico con recálculo y validaciones server-side.

## Escala tipográfica operativa

Desde 2026-09-22, las interfaces operativas de Alentó deben evitar microtexto excesivo.

Escala base definida en `src/app/globals.css`:

- `--ui-text-micro: 10px`: ayudas muy secundarias;
- `--ui-text-label: 11px`: rótulos y etiquetas;
- `--ui-text-control: 13px`: inputs, selects y botones;
- `--ui-text-body: 14px`: texto normal;
- `--ui-text-status: 16px`: estados y acciones;
- `--ui-text-title: 20px`: títulos de bloque.

Reglas:

- no usar texto operativo por debajo de 10 px;
- evitar `font-black` en tamaños pequeños;
- preferir `font-semibold` / `font-bold` para controles y etiquetas;
- `font-synthesis: none` está activo globalmente para evitar negrillas sintéticas borrosas;
- usar las clases `alento-ui-micro`, `alento-ui-label`, `alento-ui-control`, `alento-ui-body`, `alento-ui-status` y `alento-ui-title` antes de inventar nuevos tamaños;
- si un texto es funcional o necesario para operar, debe priorizar legibilidad sobre densidad;
- `globals.css` contiene una capa de compatibilidad para clases heredadas: `text-[7px]` y `text-[8px]` se elevan a 10 px, `text-[9px]` a 11 px y negrillas pequeñas `font-black` se normalizan a peso 700;
- la impresión térmica queda excluida de esa compatibilidad porque tiene requisitos físicos distintos;
- al modificar un componente heredado, preferir migrarlo gradualmente a las clases semánticas en lugar de seguir agregando tamaños arbitrarios.

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

## Seguridad

Ya existen:

- usuarios internos;
- hash scrypt de contraseñas;
- login/logout;
- cookies HttpOnly firmadas;
- páginas internas protegidas;
- APIs internas principales protegidas;
- permisos iniciales por rol;
- administración de usuarios;
- login opcional de clientes por WhatsApp OTP.

Antes de migrar el dominio principal todavía deben completarse endurecimientos como:

- recuperación de contraseña;
- auditoría;
- revocación inmediata de sesiones activas;
- pruebas de permisos por rol;
- revisión final de secretos/cookies en producción.

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

## Domicilios y rol Repartidor

El rol operativo vigente es `DRIVER`. `DISPATCH` permanece únicamente como valor legacy de compatibilidad.

La relación pedido–repartidor ya es explícita:

- `Order.driverId → User`;
- `Order.driverAssignedAt`;
- asignación a usuarios activos DRIVER/legacy DISPATCH;
- notificación por WhatsApp al asignar;
- enlace firmado de trabajo;
- `/repartidor/pedido/[token]`;
- verificación obligatoria de productos;
- transiciones `READY → OUT_FOR_DELIVERY → ARRIVED`.

El cliente dispone de `/seguimiento/[token]` con actualización automática.

Pendiente futuro:

- ubicación GPS en vivo del repartidor;
- almacenamiento/expiración de coordenadas;
- representación de la moto sobre el mapa;
- ETA dinámico;
- reglas de privacidad y frecuencia de actualización.
