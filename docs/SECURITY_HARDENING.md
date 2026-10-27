# Hardening de autenticación y rate limiting

Última actualización: **2026-10-27**.

Estado: **IMPLEMENTADO EN REPOSITORIO — pendiente de validación productiva**.

Este documento describe la seguridad vigente para sesiones de colaboradores/clientes y límites de abuso en endpoints públicos.

## Objetivos

- invalidar sesiones internas cuando un colaborador es desactivado;
- invalidar sesiones antiguas cuando cambian roles, permisos, correo o contraseña;
- dejar de confiar en roles congelados dentro de una cookie de larga duración;
- impedir fuerza bruta contra login/OTP;
- limitar abuso de endpoints públicos con costo externo o carga elevada;
- mantener la experiencia normal del restaurante sin logins frecuentes.

## Sesiones de colaboradores

Cookie:

`alento_staff_session`

La cookie continúa:

- firmada con HMAC SHA-256;
- `HttpOnly`;
- `SameSite=Lax`;
- `Secure` en producción;
- con duración máxima de 400 días y renovación silenciosa.

La duración larga ya no implica autorización larga por sí sola.

### Revocación central

`User` incorpora:

`sessionVersion Int @default(1)`

La sesión firmada contiene su `sessionVersion`.

Para cada ruta interna protegida, el middleware:

1. valida firma y expiración de cookie;
2. consulta el usuario actual en PostgreSQL;
3. exige `active = true`;
4. compara `sessionVersion`;
5. usa los roles actuales de la DB, no los roles históricos de la cookie;
6. rechaza la sesión si la versión ya no coincide.

Next.js 15.5 permite middleware con runtime Node.js; Alentó lo usa para poder validar mediante Prisma.

### Cambios que revocan sesiones antiguas

Al editar un colaborador desde `/usuarios`, se incrementa `sessionVersion` si cambia cualquiera de estos datos:

- activo/inactivo;
- correo;
- contraseña;
- roles;
- permisos sensibles.

Si un ADMIN modifica su propia cuenta, su sesión actual se reemite con la nueva versión para no expulsar esa sesión legítima; las demás sesiones anteriores quedan invalidadas.

Cambios de nombre/WhatsApp sin cambios sensibles no necesitan revocar sesiones.

### Compatibilidad con cookies anteriores

Las cookies emitidas antes de `sessionVersion` no se invalidan masivamente durante el deploy.

Cuando una cookie legacy llega a una ruta protegida:

- el usuario se consulta en DB;
- si sigue activo, se usan sus roles actuales;
- se emite silenciosamente un token nuevo con `sessionVersion`.

Esto evita cerrar sesión a todos los dispositivos del restaurante durante la transición.

## Validación en servidor

`getStaffSession()` ya no devuelve únicamente el contenido firmado de la cookie.

Ahora vuelve a consultar `User` y verifica:

- existencia;
- `active`;
- `sessionVersion`;
- roles actuales.

`requireStaffSession()` hereda esta validación.

Esto protege también handlers que hagan autorización directamente en servidor, incluso si no dependen exclusivamente del middleware.

## Sesiones de clientes

`getCustomerSession()` ahora consulta centralmente `CustomerAccount`.

Exige:

- cuenta existente;
- `active = true`;
- mismo `customerId`;
- mismo `phoneE164`.

Una cuenta de cliente desactivada deja de ser válida aunque conserve una cookie firmada.

La cookie de cliente continúa sin conceder ningún permiso interno.

## Rate limiting persistente

Modelo:

`SecurityRateLimit`

El estado vive en PostgreSQL, no en memoria del proceso. Por tanto:

- sobrevive redeploys/reinicios;
- funciona de forma consistente si existen varias instancias;
- no depende de globals de Node.

Las claves sensibles no se guardan en texto plano.

IP, email o teléfono se transforman mediante HMAC SHA-256 usando `AUTH_SESSION_SECRET`.

Campos principales:

- `scope`;
- `keyHash`;
- `windowStartedAt`;
- `count`;
- `blockedUntil`;
- timestamps.

La clave primaria es `scope + keyHash`; no se guarda una fila por intento.

## Límites vigentes

### Login colaborador

Por IP:

- 30 intentos;
- ventana: 15 minutos;
- bloqueo: 15 minutos.

Por correo:

- 10 intentos;
- ventana: 15 minutos;
- bloqueo: 15 minutos.

Un login correcto limpia ambos buckets.

### Bootstrap primer ADMIN

Por IP:

- 10 intentos;
- ventana/bloqueo: 1 hora.

Este endpoint solo es funcional mientras no existe ningún `User`.

### Solicitud OTP cliente

Por IP:

- 20 solicitudes / 15 minutos.

Por teléfono:

- 5 solicitudes / 1 hora.

Además se conserva la regla previa:

- mínimo 60 segundos antes de solicitar otro código para el mismo teléfono.

### Verificación OTP cliente

Por IP:

- 30 intentos / 15 minutos.

Por teléfono:

- 10 intentos / 15 minutos.

Además cada `CustomerAuthCode` conserva:

- máximo 5 intentos;
- expiración de 10 minutos;
- un solo uso.

Una verificación exitosa limpia los buckets de verificación.

### Cotización pública de domicilio

`POST /api/delivery/quote`

Por IP:

- 60 consultas / 10 minutos.

Protege principalmente consumo automatizado de Google Maps/Routes.

### Elegibilidad pública de checkout

`POST /api/public-checkout/eligibility`

Por IP:

- 120 consultas / 10 minutos.

### Creación de pedido WEB

`POST /api/public-checkout`

Por IP:

- 12 intentos / 10 minutos.

Este límite reduce abuso, pero **no sustituye idempotencia**. La idempotencia de creación de pedidos/pagos pertenece al punto #7 del hardening.

## Respuesta de límite excedido

HTTP:

`429 Too Many Requests`

Headers:

- `Retry-After`;
- `X-RateLimit-Limit`;
- `X-RateLimit-Remaining`.

El body incluye `retryAfterSeconds`.

## Obtención de IP

Prioridad:

1. `cf-connecting-ip`;
2. `x-real-ip`;
3. primer valor de `x-forwarded-for`;
4. `unknown` como fallback.

EasyPanel/reverse proxy debe seguir siendo la única entrada pública habitual al servicio para que estos headers provengan del proxy confiable.

## Migración Prisma

Migración:

`20261027022000_security_sessions_rate_limits`

Incluye:

- `User.sessionVersion`;
- tabla `SecurityRateLimit`;
- índices de mantenimiento.

El despliegue se realiza normalmente mediante:

`prisma migrate deploy`

No ejecutar `db push` manualmente.

## Pruebas

`src/lib/rateLimit.test.ts`

Valida:

- prioridad de headers IP;
- hashing de claves sensibles;
- límite persistente real contra PostgreSQL efímero;
- bloqueo al exceder límite;
- limpieza del bucket.

Quality CI de referencia:

- 6 archivos de tests;
- 35 tests;
- Prisma migrate deploy: verde;
- drift: cero;
- ESLint: verde;
- TypeScript: verde;
- build: verde.

## Validación productiva para cerrar #6

Después del deploy:

1. confirmar logs:
   - migración aplicada o no pendiente;
   - Next.js `Ready`;
2. comprobar login ADMIN normal;
3. comprobar POS/Pedidos/Caja según roles vigentes;
4. usar un colaborador NO ADMIN de prueba o real en un segundo navegador/incógnito;
5. iniciar sesión con ese colaborador;
6. desde ADMIN desactivarlo o cambiar uno de sus roles;
7. en la sesión secundaria intentar navegar a una ruta interna;
8. confirmar redirección a Login / 401 y que ya no conserva el acceso anterior;
9. reactivar/corregir el colaborador si corresponde;
10. no intentar bloquear deliberadamente teléfonos/clientes reales para probar 429: los tests automatizados ya cubren el rate limiter persistente.

## Reglas de no regresión

- no volver a autorizar por roles de cookie sin validar DB;
- no eliminar `sessionVersion`;
- cambios sensibles de usuario deben incrementar `sessionVersion`;
- no guardar IP/email/teléfono en texto plano dentro de `SecurityRateLimit`;
- no reemplazar el rate limiter persistente por un Map/global en memoria;
- no aplicar límites agresivos que rompan el checkout normal;
- no exponer diferencias de OTP que permitan enumerar clientes;
- rate limiting no sustituye idempotencia.
