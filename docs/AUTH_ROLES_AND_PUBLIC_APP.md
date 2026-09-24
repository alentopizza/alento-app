# Autenticación, roles y acceso de clientes

Estado: **PRIMERA VERSIÓN IMPLEMENTADA**

Última actualización: 2026-09-23.

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

Ruta unificada:

`/login`

La antigua ruta `/cuenta/login` fue retirada y no debe volver a usarse como ruta pública canónica.

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
- `DISPATCH` permanece en Prisma únicamente como valor legacy de compatibilidad.

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
- Caja;
- puede buscar, crear y actualizar el cliente necesario para cerrar una venta desde POS;
- puede consultar cupones, elegibilidad de descuentos y cálculo de domicilio usados por POS;
- puede editar pedidos activos desde Pedidos para ajustar cantidades, agregar productos y notas de cocina, sujeto a las mismas validaciones de saldo, estado y domicilio;
- puede avanzar estados operativos desde Pedidos, incluyendo `PREPARED → READY` y cierre de pedidos cuando las demás reglas lo permiten;
- cancelar y eliminar pedidos siguen dependiendo de los permisos sensibles individuales `CANCEL_ORDERS` y `DELETE_ORDERS`;
- no recibe por ello acceso a la página CRM `/clientes`, que continúa reservada a ADMIN/POS.

### DRIVER

- no recibe acceso al dashboard general de Pedidos;
- opera mediante enlaces firmados de pedidos asignados;
- puede verificar el pedido y avanzar las etapas autorizadas de reparto.

La navegación se filtra por roles y las rutas sensibles también se validan en servidor/middleware.

## Sesión de colaboradores

Cookie:

`alento_staff_session`

Características vigentes:

- firmada con HMAC SHA-256;
- `HttpOnly`;
- `SameSite=Lax`;
- `Secure` en producción;
- duración máxima actual: 400 días;
- el middleware renueva silenciosamente la sesión cuando faltan 30 días o menos para vencer;
- cerrar sesión invalida la cookie explícitamente.

La sesión continúa siendo stateless; la persistencia larga no equivale a revocación inmediata centralizada.

El secreto proviene de `AUTH_SESSION_SECRET` y debe tener mínimo 32 caracteres aleatorios.

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

Rutas principales:

- `/interno`: ADMIN, POS, CASHIER;
- `/interno/menu`: ADMIN;
- `/pedidos`: ADMIN, POS, CASHIER;
- `/cocina`: ADMIN, KITCHEN;
- `/clientes`: ADMIN, POS;
- `/caja`: ADMIN, CASHIER;
- `/configuracion`: ADMIN;
- `/personalizacion`: ADMIN;
- `/usuarios`: ADMIN;
- `/cupones`: ADMIN;
- `/masa`: ADMIN, KITCHEN;
- `/notificaciones`: ADMIN;
- `/club-alento`: ADMIN.

Las APIs internas principales también se validan por rol en middleware y/o servidor.

Excepciones públicas del checkout de domicilio:

- `POST /api/delivery/quote`;
- `GET /api/delivery/origin`;
- `GET /api/delivery/customer-default-address`.

La tarifa y la distancia oficiales no se confían al navegador: se resuelven server-side.

`GET /api/catalog` y las APIs de autenticación permanecen públicas por definición.

## Clientes

Los clientes **no necesitan iniciar sesión para navegar la app pública ni para comprar como invitados**.

El login sirve para vincular la sesión con el `Customer` existente y habilitar información privada:

- perfil;
- direcciones;
- historial;
- pedidos;
- futuras recompensas/favoritos.

Ruta unificada de acceso:

`/login`

El formulario empieza en modo cliente y permite cambiar a colaborador sin mezclar sesiones.

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
→ enviar el OTP al webhook externo configurado en Make
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

## Entrega del OTP por WhatsApp

El código vigente no llama directamente a Meta desde la app principal.

Variable usada:

`MAKE_WHATSAPP_OTP_WEBHOOK_URL`

`src/lib/whatsappAuth.ts` envía al escenario de Make:

- teléfono E.164;
- código OTP;
- nombre.

La conexión real con WhatsApp/Meta vive fuera del núcleo de la aplicación y se considera integración opcional/exclusiva de Alentó. Ver `docs/ALENTO_EXCLUSIVE_MODULES.md`.

## Archivos principales

- `prisma/schema.prisma`
- `src/lib/auth.ts`
- `src/lib/whatsappAuth.ts`
- `src/middleware.ts`
- `src/app/login/page.tsx`
- `src/app/setup/admin/page.tsx`
- `src/app/usuarios/page.tsx`
- `src/app/login/page.tsx`
- `src/app/cuenta/page.tsx`
- `src/app/api/auth/**`
- `src/app/api/users/**`

## Variables obligatorias

### Siempre

`AUTH_SESSION_SECRET`

`AUTH_BOOTSTRAP_KEY` durante la creación del primer administrador.

### OTP de cliente cuando se habilita la integración Alentó

`MAKE_WHATSAPP_OTP_WEBHOOK_URL`

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

- recuperación de contraseña de colaboradores todavía no existe;
- auditoría completa de cambios de usuarios todavía no existe;
- la sesión interna es stateless y no tiene revocación inmediata centralizada;
- no existe segundo factor para colaboradores;
- el login OTP depende del webhook externo de Make y de la infraestructura WhatsApp/Meta configurada detrás de ese escenario;
- la experiencia pública ya crea pedidos `source=WEB` y ofrece seguimiento firmado;
- el GPS en vivo, mapa, ETA y flujo operativo del repartidor ya están implementados;
- recuperación de contraseña y revocación central de sesiones siguen pendientes.

## Regla pública vigente

La experiencia pública ya está construida parcialmente y debe permanecer navegable como invitado.

No bloquear por falta de login:

- Home;
- menú;
- búsqueda;
- producto;
- carrito;
- explicación de Club;
- selección inicial de modalidad/dirección.

Sí exigir sesión para operaciones privadas como historial, datos personales, direcciones persistidas y saldo/movimientos individuales del Club.

El checkout final ya acepta invitado o sesión. Nunca debe conceder permisos internos ni reutilizar la sesión de colaborador.

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

El rol operativo es `DRIVER` y se muestra como Repartidor.

No hereda acceso al dashboard general de Pedidos, Caja, POS ni permisos sensibles.

Ya existe:

- relación `Order.driverId` con `User`;
- asignación desde operación;
- WhatsApp del repartidor en `User`;
- enlace firmado por pedido;
- `/repartidor/pedido/[token]`;
- checklist obligatorio de productos;
- transición `READY → OUT_FOR_DELIVERY`;
- transición `OUT_FOR_DELIVERY → ARRIVED`;
- seguimiento del cliente con autoactualización.

GPS en vivo, mapa dinámico, rutas, ETA y navegación del repartidor ya están implementados.

`DISPATCH` se conserva únicamente como valor legacy en Prisma.

### Visibilidad de permisos sensibles

Los permisos `CANCEL_ORDERS` y `DELETE_ORDERS` solo son configurables cuando el colaborador tiene alguno de estos roles:

- `ADMIN`;
- `POS`;
- `CASHIER`.

Un usuario únicamente `KITCHEN` o `DRIVER` no ve estos permisos y el backend limpia cualquier permiso sensible heredado cuando se guardan sus roles.

## Superficie pública vigente

Rutas canónicas:

- `/`: Home pública;
- `/menu`: menú y configurador;
- `/cart`: carrito;
- `/club`: Club Alentó;
- `/login`: acceso unificado;
- `/cuenta`: perfil privado del cliente;
- `/seguimiento/[token]`: seguimiento firmado.

La autenticación del cliente es opcional para navegar.

La raíz `/` ya no es POS. El POS está en `/interno`.

El catálogo público consume `/api/catalog` y no existe un catálogo duplicado.

## Acceso unificado cliente / colaborador

El acceso principal abre en modo Cliente:

`teléfono → OTP por WhatsApp`

En la parte inferior aparece:

`Iniciar como colaborador`

Al activarlo, el mismo formulario cambia a:

`correo + contraseña`

No se mezclan las sesiones ni las identidades. El formulario es compartido, pero continúa usando:

- `alento_customer_session` para clientes;
- `alento_staff_session` para colaboradores.

Después de iniciar sesión como colaborador, el destino depende de roles. El Punto de Venta se encuentra en `/interno`.


## Privacidad en la recuperación por teléfono

La interfaz pública no debe indicar si un teléfono ya existe en la base de clientes antes de verificar su propiedad.

Regla:

- escribir un número válido puede ofrecer la acción **Verificar mi número**;
- el mensaje debe ser neutral y no afirmar que ese teléfono ya compró;
- si después del OTP existe un Customer, se recuperan sus datos;
- si no existe, la verificación puede crear su identidad de cliente sin revelar previamente esa condición;
- no agregar endpoints públicos de tipo `existsByPhone` o mensajes distintos según existencia, porque permitirían enumerar clientes.
