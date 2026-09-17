# Pagos, abonos y medios de pago

Este documento define la semántica de pagos de Alentó App.

## Principio principal

El medio elegido al crear una orden en POS y un ingreso registrado posteriormente no representan lo mismo.

### POS: intención de pago

Cuando se crea el pedido, el POS pregunta qué medio de pago indica el cliente.

Ese dato se guarda inicialmente como un `Payment` con estado `PENDING`.

Representa una **intención o medio previsto**, no dinero recibido.

Ejemplos:

- el cliente dice que pagará por Nequi;
- el cliente dice que pagará en efectivo;
- si es efectivo, `Paga con` puede conservarse como referencia para calcular cambio.

Un `PENDING` nunca debe contabilizarse en Caja.

El cliente puede cambiar de medio posteriormente. El medio previsto solo sirve como sugerencia inicial al abrir `Registrar pago`.

## Pedidos: dinero realmente recibido

La pantalla `/pedidos` es donde se registran los movimientos reales de dinero.

Cada vez que se registra un ingreso se crea un **nuevo registro `Payment` con estado `PAID`**.

Un registro `PAID` contiene:

- medio realmente recibido;
- monto del abono;
- referencia opcional;
- efectivo entregado cuando corresponde;
- cambio cuando corresponde;
- fecha/hora real (`paidAt`).

Caja solo suma registros `PAID`.

## Pagos parciales

Una orden puede tener múltiples movimientos `PAID`.

Ejemplo para un pedido de $50.000:

```text
Total pedido          $50.000

Pago 1
Nequi                 $25.000
Saldo                 $25.000

Pago 2
Efectivo              $25.000
Saldo                      $0
```

También se pueden registrar más de dos pagos.

Ejemplo de cuenta dividida:

```text
DaviPlata             $15.000
Nequi                  $10.000
Efectivo               $25.000
------------------------------
Total recibido         $50.000
```

Cada movimiento aparece por separado en Caja y participa en el total de su medio de pago.

## Modal Registrar pago

El modal muestra:

- saldo actual;
- monto de este pago;
- medio de pago realmente recibido;
- `Paga con` únicamente cuando el medio es Efectivo;
- referencia opcional;
- saldo estimado después del abono.

El monto puede ser menor al saldo, pero nunca mayor.

Al abrir el modal el monto se inicializa con el saldo completo para facilitar pagos normales. El operador puede reducirlo para registrar un abono parcial.

El medio se inicializa con el medio previsto del POS cuando existe, pero el operador puede cambiarlo libremente antes de registrar el ingreso.

## Efectivo

Para un movimiento en efectivo existen dos valores distintos:

- `amount`: cuánto del pedido se está pagando;
- `cashReceived`: cuánto efectivo entregó físicamente el cliente.

Ejemplo:

```text
Abono                 $20.000
Cliente entrega        $50.000
Cambio                 $30.000
```

El cambio se calcula únicamente contra el monto de ese movimiento, no contra el total original del pedido.

## Saldo

El saldo de una orden se calcula siempre como:

```text
Order.total - suma(Payment.amount donde status = PAID)
```

Los registros `PENDING`, `PARTIAL`, `CANCELED` o `REFUNDED` no se cuentan como ingreso recibido.

## Medio previsto después de un abono

Si existe un `Payment PENDING` creado desde POS y se registra un abono parcial:

- se crea un nuevo `Payment PAID` por el monto realmente recibido;
- el `PENDING` conserva su medio previsto;
- su `amount` se ajusta al saldo restante;
- `cashReceived` y `changeDue` del pendiente se limpian porque todavía no representan dinero recibido.

Cuando el saldo llega a cero, el pendiente se marca `CANCELED` con monto cero.

## Eliminación de pagos

`DELETE /api/orders/[id]/payment/[paymentId]` elimina físicamente un movimiento registrado por error.

Si se elimina un `PAID`:

- desaparece de Caja;
- el saldo del pedido aumenta;
- si existe una referencia `PENDING`, su monto se recalcula al nuevo saldo.

Eliminar un pago real por error es distinto a una futura devolución/reembolso. Las devoluciones deberán conservar trazabilidad y usar un flujo específico.

## Edición del pedido y pagos

Editar un pedido no debe tratar el medio previsto como dinero recibido.

Si una orden aumenta de valor:

- los `PAID` existentes se conservan;
- el saldo aumenta;
- un `PENDING` se ajusta al nuevo saldo;
- un antiguo `Paga con` que ya no cubra el total se limpia.

Si una edición deja el total por debajo de la suma ya recibida en `PAID`, la edición se bloquea hasta implementar el flujo de devolución.

## Caja

`/api/caja/summary` solo consulta pagos:

```text
status = PAID
```

Por ello un pedido puede aportar varios movimientos a Caja y varios medios de pago sin duplicar el total del pedido.

## Archivos principales

- `prisma/schema.prisma` — modelo `Payment` y `PaymentStatus`;
- `src/app/api/orders/route.ts` — crea la intención inicial `PENDING` desde POS;
- `src/app/api/orders/[id]/payment/route.ts` — registra abonos reales `PAID`;
- `src/app/api/orders/[id]/payment/[paymentId]/route.ts` — elimina movimientos y reajusta saldo previsto;
- `src/app/api/orders/[id]/route.ts` — recalcula pagos pendientes cuando se edita una orden;
- `src/components/OrdersCardsDashboardV3.tsx` — registro y visualización de pagos;
- `src/app/api/caja/summary/route.ts` — suma únicamente dinero realmente recibido.

## Base de datos

Esta funcionalidad utiliza la relación existente `Order 1:N Payment`.

No requiere cambios en Prisma ni `npx prisma db push`.
