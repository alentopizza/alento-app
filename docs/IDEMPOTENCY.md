# Idempotencia de pedidos y pagos

Última actualización: **2026-10-27**.

Estado: **IMPLEMENTADO EN REPOSITORIO — pendiente de validación productiva**.

Este documento describe la protección de Alentó App frente a doble clic, reintentos de red, timeouts y solicitudes simultáneas en operaciones que pueden crear dinero o pedidos duplicados.

## Principio

Una operación crítica debe tener un identificador estable por intento.

El cliente genera:

`Idempotency-Key`

y reutiliza exactamente la misma clave mientras intenta confirmar la misma operación.

El servidor persiste esa clave junto con un hash canónico del request.

Reglas:

- misma clave + mismo request → devolver el recurso ya creado;
- misma clave + request diferente → HTTP 409;
- clave ausente en una operación crítica → HTTP 428;
- una clave confirmada nunca debe crear un segundo recurso.

## Operaciones protegidas

### Crear pedido POS

`POST /api/orders`

Cliente:

`OrderCheckoutModal`

El navegador genera una clave al primer intento de confirmación y la conserva mientras haya un error ambiguo de red.

La clave se elimina únicamente cuando la API confirma el pedido.

### Crear pedido WEB

`POST /api/public-checkout`

Cliente:

`PublicCheckoutCustomer`

Se aplica la misma política de reutilización.

Los replays devuelven el pedido ya persistido y **no vuelven a enviar**:

- mensaje de pedido;
- push de Cocina;
- webhook de contacto.

### Registrar pago

`POST /api/orders/[id]/payment`

Cliente vigente:

`OrdersCardsDashboardV3`

Cada intento de pago conserva una clave por pedido hasta que el servidor confirma el resultado.

## Persistencia

### Order

Campos:

- `idempotencyKey String? @unique`;
- `idempotencyHash String?`.

### Payment

Campos:

- `idempotencyKey String? @unique`;
- `idempotencyHash String?`.

Los campos son opcionales para conservar compatibilidad con datos históricos.

PostgreSQL mantiene índices únicos sobre ambas claves.

Migración:

`20261027030000_order_payment_idempotency`

## Hash del request

`src/lib/idempotency.ts` genera SHA-256 sobre una serialización canónica.

La serialización:

- ordena propiedades de objetos;
- conserva el orden de arrays;
- ignora propiedades `undefined`.

El hash incluye también el tipo de operación:

- `POS_ORDER_CREATE`;
- `WEB_ORDER_CREATE`;
- `ORDER_PAYMENT_CREATE`.

Para pagos incluye además `orderId`.

Esto impide reutilizar accidentalmente una clave entre operaciones distintas.

## Serialización de pedidos

Antes de crear un pedido, la API consulta por `idempotencyKey`.

Si ya existe:

- valida el hash;
- devuelve HTTP 200;
- agrega header `Idempotency-Replayed: true`;
- no repite efectos secundarios.

Si no existe, dentro de la transacción se ejecuta:

`pg_advisory_xact_lock(hashtextextended(Idempotency-Key, 0))`

Después del lock se consulta nuevamente la clave.

Esto protege incluso carreras que ocurren **antes** del INSERT del pedido, como creación/actualización de cliente o dirección en checkout WEB.

La primera solicitud crea el pedido.

La segunda espera el lock y después encuentra el mismo pedido ya creado.

## Serialización de pagos

La lógica canónica vive en:

`src/lib/orderPaymentRegistration.ts`

Dentro de la transacción se ejecuta:

`SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`

Después del bloqueo:

1. se revisa otra vez `idempotencyKey`;
2. se cargan los pagos actuales;
3. se recalcula el total realmente pagado;
4. se recalcula el saldo pendiente;
5. solo entonces se valida el nuevo monto;
6. se crea el pago;
7. se ajusta/cancela el movimiento pendiente.

Esto protege dos riesgos distintos:

### Reintento idéntico

Dos requests con la misma clave producen un solo `Payment`.

### Cobros simultáneos diferentes

Incluso con dos claves distintas, dos terminales no pueden cobrar al mismo tiempo el mismo saldo usando un valor desactualizado.

La segunda transacción espera el lock y recalcula el saldo después del primer pago.

## Respuestas

### Creación original

HTTP:

`201 Created`

Body incluye:

`replayed: false`

### Replay

HTTP:

`200 OK`

Header:

`Idempotency-Replayed: true`

Body incluye:

`replayed: true`

### Misma clave con request diferente

HTTP:

`409 Conflict`

Código:

`IDEMPOTENCY_KEY_CONFLICT`

### Clave ausente

HTTP:

`428 Precondition Required`

Código:

`IDEMPOTENCY_KEY_REQUIRED`

La decisión de fallar de forma segura es deliberada: una versión cliente antigua no debe poder crear silenciosamente un pedido o cobro sin protección contra duplicados.

## Generación en navegador

Helper:

`src/lib/clientIdempotency.ts`

Preferencia:

`crypto.randomUUID()`

Existe fallback mediante `crypto.getRandomValues()`.

No usar:

- timestamps solos;
- consecutivos locales;
- Math.random;
- claves derivadas del total del pedido.

## Pruebas automatizadas

### `src/lib/idempotency.test.ts`

Valida:

- lectura del header;
- rechazo cuando falta;
- hash canónico;
- conflicto de contenido;
- índice único de `Order.idempotencyKey`;
- índice único de `Payment.idempotencyKey`.

### `src/lib/orderPaymentRegistration.test.ts`

Valida contra PostgreSQL real efímero:

- dos cobros simultáneos por el saldo completo;
- solo uno termina como `PAID`;
- el segundo termina 409 porque el pedido ya quedó pagado;
- replay con misma clave crea un solo pago.

Quality CI de referencia:

- migración `20261027030000_order_payment_idempotency`: aplicada;
- drift: **No difference detected**;
- ESLint: verde;
- TypeScript: verde;
- **8 archivos / 43 tests**;
- Next build: verde;
- workflow run: `40439799102`.

## Validación productiva para cerrar #7

Después del deploy:

1. confirmar que Prisma aplica `20261027030000_order_payment_idempotency`;
2. confirmar Next.js `Ready`;
3. crear un pedido POS normal y verificar que operación/impresión continúan funcionando;
4. crear o confirmar un pedido WEB normal desde la app pública;
5. registrar un pago desde Pedidos y verificar saldo/Caja;
6. confirmar que no aparecen errores `IDEMPOTENCY_KEY_REQUIRED` en las superficies actuales;
7. no provocar cobros duplicados reales para probar concurrencia: esa carrera ya está cubierta por test automatizado contra PostgreSQL.

## Reglas de no regresión

- no retirar `Idempotency-Key` de creación POS/WEB ni registro de pago;
- una UI debe conservar la misma clave después de un timeout/error de red ambiguo;
- no generar una nueva clave automáticamente en cada retry;
- no eliminar los índices únicos;
- no mover el cálculo de saldo de pago fuera del lock transaccional;
- no reenviar notificaciones durante un replay;
- no confundir idempotencia con rate limiting;
- no confundir idempotencia con Audit Log;
- nuevas integraciones que creen pedidos/pagos deben adoptar una clave idempotente estable del proveedor o generar una equivalente.
