# Autenticación, roles y acceso de clientes

Estado: **PRIMERA VERSIÓN IMPLEMENTADA**

Última actualización: 2026-09-20.

Este documento describe la autenticación vigente de Alentó App y la separación entre colaboradores internos y clientes.

## Principio central

Existen dos identidades distintas:

```text
User      → colaborador interno
Customer  → comprador
```

Nunca reutilizar `Customer` como usuario administrativo.

## Colaboradores

Los colaboradores ingresan con:

- correo;
- contraseña asignada al crear el usuario.

Ruta:

`/login`

Las contraseñas se guardan como hash `scrypt` con salt aleatorio.

Nunca se guarda una contraseña en texto plano.

## Modelo User

Campos principales:

- `id`;
- `name`;
- `email` único;
- `passwordHash`;
- `roles UserRole[]`;
- `active`;
- `lastLoginAt`;
- timestamps.

Roles actuales:

- `ADMIN`;
- `POS`;
- `KITCHEN`;
- `CASHIER`;
- `DRIVER`.

Un usuario puede tener varios roles.

## Usuarios y Roles

Ruta:

`/usuarios`

Solo `ADMIN`.

Permite:

- listar colaboradores;
- crear usuario;
- asignar uno o varios roles;
- editar nombre/correo;
- cambiar contraseña;
- activar/desactivar usuario.

No permite que el administrador logueado se quite a sí mismo el rol ADMIN ni se desactive desde ese flujo.

## Permisos iniciales

### ADMIN

Acceso total al sistema interno.

### POS

- Punto de venta;
- Pedidos;
- Clientes.

### KITCHEN

- Cocina.

### CASHIER

- Punto de venta;
- Pedidos;
- Caja.

### DRIVER

- Pedidos.

La navegación se filtra por roles y las rutas sensibles también se validan en servidor/middleware.

## Sesión de colaboradores

Cookie:

`alento_staff_session`

Características:

- firmada con HMAC SHA-256;
- `HttpOnly`;
- `SameSite=Lax`;
- `Secure` en producción;
- duración actual: 12 horas.

El secreto proviene de:

`AUTH_SESSION_SECRET`

Debe tener mínimo 32 caracteres y ser aleatorio.

## Primer administrador

Mientras `User.count() === 0`, el login ofrece:

`/setup/admin`

El formulario exige:

- nombre;
- correo;
- contraseña;
- `AUTH_BOOTSTRAP_KEY`.

Al crear el primer administrador:

- se crea con rol `ADMIN`;
- se inicia sesión automáticamente;
- el bootstrap deja de funcionar porque ya existe un usuario.

No reutilizar la bootstrap key como contraseña de usuario.

## Protección de rutas internas

La primera versión protege:

- `/` POS;
- `/pedidos`;
- `/cocina`;
- `/clientes`;
- `/menu`;
- `/cupones`;
- `/caja`;
- `/configuracion`;
- `/usuarios`.

También protege las APIs internas correspondientes:

- `/api/users`;
- `/api/menu-admin`;
- `/api/settings`;
- `/api/coupons`;
- `/api/caja`;
- `/api/customers`;
- `/api/orders`;
- `/api/delivery`;
- `/api/discount`.

`/api/catalog` permanece público porque será compartido con la futura app de clientes.

Las APIs de autenticación también permanecen públicas por definición.

## Clientes

Los clientes **no necesitan iniciar sesión para navegar la futura app pública**.

El login sirve para vincular la sesión con el `Customer` existente y habilitar información privada:

- perfil;
- direcciones;
- historial;
- pedidos;
- futuras recompensas/favoritos.

Ruta actual de acceso:

`/cuenta/login`

Ruta de perfil:

`/cuenta`

## Identidad de clientes

El identificador principal es el teléfono.

El sistema normaliza:

```text
3001234567
+57 3001234567
573001234567
```

a una identidad E.164 conceptual:

`+573001234567`

La cuenta de acceso vive en `CustomerAccount`, separada de `Customer`.

## CustomerAccount

Campos:

- `id`;
- `customerId` único;
- `phoneE164` único;
- `phoneVerifiedAt`;
- `active`;
- timestamps.

La cuenta se crea automáticamente cuando un cliente verifica exitosamente su primer código.

## OTP por WhatsApp

Flujo:

```text
Cliente escribe teléfono
→ POST /api/auth/customer/request-code
→ localizar Customer
→ generar código de 6 dígitos
→ guardar hash del código
→ enviar plantilla AUTHENTICATION por WhatsApp Cloud API
→ cliente escribe código
→ POST /api/auth/customer/verify-code
→ verificar hash / expiración / intentos
→ crear o actualizar CustomerAccount
→ crear cookie de cliente
→ /cuenta
```

El código:

- tiene 6 dígitos;
- vence en 10 minutos;
- máximo 5 intentos;
- no puede reutilizarse;
- no se guarda en texto plano;
- tiene espera mínima de 60 segundos antes de solicitar otro.

## Sesión de cliente

Cookie:

`alento_customer_session`

Características:

- firmada;
- `HttpOnly`;
- `SameSite=Lax`;
- `Secure` en producción;
- duración: 30 días.

La sesión de cliente **no concede ningún permiso interno**.

## WhatsApp Cloud API

Variables:

- `WHATSAPP_ACCESS_TOKEN`;
- `WHATSAPP_PHONE_NUMBER_ID`;
- `WHATSAPP_GRAPH_VERSION`;
- `WHATSAPP_AUTH_TEMPLATE_NAME`;
- `WHATSAPP_AUTH_LANGUAGE_CODE`.

Se utiliza una plantilla de categoría `AUTHENTICATION` con botón OTP tipo copy-code.

El valor OTP se envía tanto como parámetro del body como del botón.

La plantilla debe existir y estar aprobada en la cuenta de WhatsApp Business antes de usar producción.

## Modo desarrollo

Si WhatsApp todavía no está conectado se puede habilitar:

`WHATSAPP_DEV_LOG_OTP=1`

Solo fuera de producción.

Esto imprime el OTP en logs para probar el flujo.

**Nunca activar en producción.**

## Archivos principales

- `prisma/schema.prisma`
- `src/lib/auth.ts`
- `src/lib/whatsappAuth.ts`
- `src/middleware.ts`
- `src/app/login/page.tsx`
- `src/app/setup/admin/page.tsx`
- `src/app/usuarios/page.tsx`
- `src/app/cuenta/login/page.tsx`
- `src/app/cuenta/page.tsx`
- `src/app/api/auth/**`
- `src/app/api/users/**`

## Variables obligatorias

### Siempre

`AUTH_SESSION_SECRET`

`AUTH_BOOTSTRAP_KEY` durante la creación del primer administrador.

### WhatsApp en producción

`WHATSAPP_ACCESS_TOKEN`

`WHATSAPP_PHONE_NUMBER_ID`

`WHATSAPP_GRAPH_VERSION`

`WHATSAPP_AUTH_TEMPLATE_NAME`

`WHATSAPP_AUTH_LANGUAGE_CODE`

## Prisma

Esta implementación agrega:

- enum `UserRole`;
- model `User`;
- model `CustomerAccount`;
- model `CustomerAuthCode`;
- relación `Customer.account`.

Después del deploy:

```bash
npx prisma db push
```

Es obligatorio antes de probar login.

## Limitaciones conocidas de esta primera versión

- la app pública completa todavía no está construida;
- `/` continúa siendo POS, por lo que sigue protegido como ruta interna;
- todavía no existe recuperación de contraseña por correo;
- todavía no existe auditoría de cambios de usuarios;
- la sesión interna es stateless firmada: cambios de roles/desactivación se reflejan plenamente al renovar/iniciar nuevamente la sesión; en una fase posterior puede añadirse revocación inmediata basada en sesiones persistidas;
- no existe segundo factor para colaboradores;
- WhatsApp depende de Meta, plantilla aprobada y credenciales válidas.

## Futuro al construir la app pública

La experiencia pública debe permanecer navegable como invitado.

Login será opcional y debe aparecer como:

`Ingresar / Mi cuenta`

Nunca bloquear:

- home;
- catálogo;
- búsqueda;
- producto;
- carrito inicial

solo por no haber iniciado sesión.

Las operaciones privadas sí deben exigir sesión:

- ver historial;
- editar datos personales;
- administrar direcciones privadas;
- recompensas;
- favoritos sincronizados;
- seguimiento privado cuando corresponda.

## Regla de no regresión

- no mezclar cookies de cliente y colaborador;
- no usar teléfono como contraseña;
- no guardar OTP en texto plano;
- no guardar contraseña interna en texto plano;
- no conceder acceso interno desde `CustomerAccount`;
- no obligar al cliente a loguearse para navegar;
- no crear un segundo modelo comercial de cliente para autenticación;
- mantener autorización de operaciones internas del lado servidor.


## Permisos sensibles por usuario

Además de los roles, `User` dispone de permisos granulares para acciones sensibles.

Permisos actuales:

- `CANCEL_ORDERS`;
- `DELETE_ORDERS`.

Reglas:

- `ADMIN` hereda ambos permisos de forma implícita;
- ningún otro rol los recibe automáticamente;
- un usuario `POS`, `CASHIER`, `DRIVER` u otro puede recibirlos individualmente;
- el permiso se administra desde `/usuarios`;
- cancelar y eliminar son permisos distintos;
- eliminar sigue requiriendo que el pedido esté previamente `CANCELED`;
- la API consulta los permisos vigentes en base de datos al ejecutar estas acciones.

Esto evita que un cajero pueda cancelar o borrar pedidos solo por pertenecer al rol Caja.


## Rol Repartidor

El rol operativo para domicilio es `DRIVER` y se muestra como **Repartidor**.

No hereda acceso al dashboard general de Pedidos, Caja, POS ni permisos para cancelar/eliminar.

Objetivo futuro:

- pantalla propia de domicilios disponibles;
- asignación de pedido a repartidor;
- domicilios asignados;
- datos necesarios para entrega;
- transición de estados de reparto autorizados;
- ubicación/tracking cuando se implemente;
- información de seguimiento reutilizable por la app del cliente.

El valor histórico `DISPATCH` se conserva temporalmente únicamente en el enum de Prisma para evitar pérdida de datos en instalaciones existentes. La UI y las APIs de administración lo normalizan a `DRIVER`.

### Visibilidad de permisos sensibles

Los permisos `CANCEL_ORDERS` y `DELETE_ORDERS` solo son configurables cuando el colaborador tiene alguno de estos roles:

- `ADMIN`;
- `POS`;
- `CASHIER`.

Un usuario únicamente `KITCHEN` o `DRIVER` no ve estos permisos y el backend limpia cualquier permiso sensible heredado cuando se guardan sus roles.
