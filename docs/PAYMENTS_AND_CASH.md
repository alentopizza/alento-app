# Pagos y Caja

Este documento define la diferencia entre el medio de pago elegido al crear una orden y el dinero realmente recibido por Alentó Pizza.

## Principio principal

Seleccionar `Efectivo`, `Nequi`, `DaviPlata`, `Tarjeta` o `Llave` en el cierre del POS NO significa que el ingreso ya entró a Caja.

Al crear el pedido:

- se guarda un `Payment` con el medio previsto;
- `Payment.status = PENDING`;
- `paidAt = null`;
- el pedido puede continuar su operación aunque el dinero todavía no esté registrado como recibido.

Caja solo cuenta pagos con:

- `Payment.status = PAID`;
- `Payment.paidAt != null`.

## Registrar pago

Endpoint:

`POST /api/orders/[id]/payment`

El operador selecciona el medio realmente recibido y opcionalmente una referencia.

Para efectivo también registra `Paga con`; el servidor calcula `changeDue`.

Al registrar:

- `status` pasa a `PAID`;
- `paidAt` usa la hora real del registro;
- `method` representa el medio realmente recibido;
- `reference` puede guardar referencia de Nequi/DaviPlata u otro comprobante.

## Anular un pago ingresado por error

Dentro del detalle del pedido se muestra el historial de movimientos de pago. Cada pago recibido puede anularse desde allí.

Endpoint:

`DELETE /api/orders/[id]/payment/[paymentId]`

La aplicación no borra físicamente el movimiento. Lo marca como:

`Payment.status = CANCELED`

Esto tiene tres efectos:

- deja de contar en Caja inmediatamente;
- el pedido vuelve a mostrar el saldo pendiente correspondiente;
- el movimiento sigue visible como `ANULADO`, conservando medio, valor, hora y demás datos de auditoría.

Un pago con estado `REFUNDED` no puede anularse porque pertenece al futuro flujo formal de devoluciones.

## Pagos posteriores a una edición

Un pago ya `PAID` no se modifica para ajustar una orden posterior.

Ejemplo:

1. Pedido total: $24.900.
2. Cliente paga $24.900 por Nequi.
3. Después agrega una bebida de $5.000.
4. El pago original de $24.900 permanece intacto.
5. El pedido queda con saldo pendiente de $5.000.
6. Al cobrar el saldo se registra otro Payment por $5.000.

Esto permite que Caja refleje dinero real y evita reescribir movimientos históricos.

Si una edición intenta bajar el total por debajo del dinero ya recibido, el servidor la bloquea. Esa operación necesita un flujo de devolución/refund, que debe implementarse aparte.

## Cancelación y borrado

Un pedido con dinero recibido no puede eliminarse como prueba mientras tenga pagos `PAID`.

Si un pago fue ingresado por error, primero puede anularse desde el historial. Una vez que no queden pagos recibidos, el pedido de prueba puede eliminarse según las reglas del dashboard.

## Caja

Ruta:

`/caja`

API:

`GET /api/caja/summary?date=YYYY-MM-DD`

El resumen diario usa `paidAt` y zona horaria de Colombia para agrupar los ingresos del día.

Muestra:

- total realmente recibido;
- cantidad de pagos;
- acumulado por medio de pago;
- lista de movimientos con pedido, cliente, hora, medio, referencia y valor.

No suma órdenes pendientes ni movimientos `CANCELED`.

## Próximas extensiones contables

El modelo está preparado conceptualmente para continuar con:

- devoluciones (`REFUNDED`);
- pagos parciales;
- pagos mixtos;
- cierre de caja por turno;
- usuario/cajero que recibió el pago;
- conciliación de Nequi/DaviPlata/Tarjeta;
- gastos y retiros de caja;
- arqueo de efectivo;
- reportes diarios, semanales y mensuales.

## Cambio de esquema

Se agregó previamente:

```prisma
paidAt DateTime?
```

a `Payment` y el índice:

```prisma
@@index([status, paidAt])
```

El flujo de anulación de pago NO agrega columnas nuevas. Si `paidAt` ya fue sincronizado anteriormente, esta iteración no requiere un nuevo `prisma db push`.
