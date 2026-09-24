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

## Eliminar un pago ingresado por error

Endpoint:

`DELETE /api/orders/[id]/payment/[paymentId]`

La eliminación es física. La fila `Payment` desaparece de PostgreSQL.

Consecuencias:

- deja de contar inmediatamente en Caja;
- deja de formar parte del total pagado de la orden;
- el pedido vuelve a mostrar ese valor como saldo pendiente;
- después de eliminar los pagos de una orden, esa orden puede eliminarse definitivamente si así lo decide el operador.

Esta acción es distinta a una devolución real al cliente. Una devolución futura deberá registrarse con su propio flujo contable y no reutilizar este borrado operativo.

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

## Eliminar pedido vs cancelar pedido

Son decisiones distintas:

- **Eliminar pedido**: borra físicamente la orden. Sus `OrderItem` y `Payment` relacionados se eliminan por `onDelete: Cascade`.
- **Cancelar pedido**: conserva la orden y la marca `CANCELED` para mantener historial.

Para borrar una orden que tiene pagos registrados, primero se eliminan físicamente esos pagos y luego se elimina la orden.

## Caja

Ruta:

`/caja`

API principal:

`GET /api/caja/summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

`date=YYYY-MM-DD` sigue aceptándose como compatibilidad de un solo día.

Caja usa la zona horaria de Colombia y separa cuatro conceptos:

- **Ventas**: suma de pedidos creados dentro del rango, excluyendo DRAFT y CANCELED.
- **Cobros de ventas**: suma únicamente `Payment.status = PAID` por `paidAt` dentro del rango.
- **Otros ingresos**: suma de `CashIncome.amount` por `occurredAt` dentro del rango.
- **Entró total**: cobros de ventas + otros ingresos.
- **Salió**: suma de `CashExpense.amount` por `occurredAt` dentro del rango.
- **Flujo neto**: entró total menos salidas.

También muestra:

- cantidad de pedidos vendidos;
- cantidad de pagos recibidos;
- distribución por medio de pago;
- distribución de salidas por categoría;
- movimientos recientes de ingresos;
- movimientos recientes de salidas.

No suma órdenes pendientes solo porque tengan un medio de pago seleccionado.

Cuando un Payment se elimina físicamente, desaparece del resumen de Caja.

## Numeración de pedidos

La numeración operativa está documentada en:

`docs/ORDER_NUMBERING.md`

POS y WEB comparten la misma secuencia global de `Order.sequenceNumber`; solo cambia el prefijo visible.

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

## Cambio de esquema existente

`Payment` contiene:

```prisma
paidAt DateTime?
```

y el índice:

```prisma
@@index([status, paidAt])
```

Si el entorno todavía no tiene ese campo sincronizado, ejecutar:

```bash
npx prisma db push
```

Los cambios de eliminación física y de numeración no agregan columnas nuevas.


## Cancelación después de recibir dinero

Todavía no existe un flujo contable de devolución/refund.

Por seguridad, si un pedido tiene uno o más movimientos `PAID`, la cancelación queda bloqueada.

Motivo: marcar como cancelado el dinero recibido sin crear un movimiento de devolución rompería la trazabilidad de Caja.

Flujo vigente:

```text
sin pagos PAID → se puede cancelar
con pagos PAID → bloquear cancelación → implementar/registrar refund antes de permitirla
```

No retirar esta protección hasta que exista un movimiento `REFUNDED` auditable.


## Salidas de Caja

Modelo:

`CashExpense`

Campos principales:

- `category`: tipo de salida;
- `subcategory`: subtipo opcional;
- `note`: observación;
- `amount`: monto;
- `occurredAt`: fecha/hora real de la salida;
- `source`: `MANUAL` o `GLIDE_IMPORT`;
- `createdByName`: colaborador que registró/importó.

Rutas:

- `POST /api/caja/expenses`: registrar salida;
- `DELETE /api/caja/expenses/[id]`: eliminar una salida registrada por error;
- `GET/POST /api/caja/expenses/import`: migración histórica ADMIN.

Categorías sugeridas vigentes:

- Maquinaria;
- Insumos;
- Nomina;
- Domicilios;
- Servicios Públicos;
- Plataformas;
- Parqueadero;
- Otros;
- Arriendo;
- Publicidad;
- Consumo Interno.

Los subtipos son sugerencias, no enums rígidos: el usuario puede escribir un valor nuevo para no bloquear la operación.

### Importación histórica

La migración histórica de salidas es de una sola ejecución y usa CSV con columnas:

`Fecha, Tipo De Gasto, Observación, Monto, Sub Tipo De Gasto`

Al completar la importación se crea el lock:

`cash_expenses_import_v1`

No volver a ejecutar la misma migración después de crear ese lock.


## Otros ingresos de Caja

Modelo:

`CashIncome`

Se usa para entradas de dinero que no están asociadas a un `Payment` de un pedido, por ejemplo:

- ingresos de Rappi;
- retornos o ajustes de Wompi;
- préstamos;
- ventas históricas no facturadas/no registradas como Order;
- ajustes u otras entradas extraordinarias.

Campos:

- `category`: tipo de ingreso;
- `note`: observación;
- `amount`: monto;
- `occurredAt`: fecha/hora real de ingreso;
- `source`: `MANUAL` o `GLIDE_IMPORT`;
- `createdByName`: responsable del registro/importación.

Rutas:

- `POST /api/caja/incomes`: registrar otro ingreso;
- `DELETE /api/caja/incomes/[id]`: eliminar un ingreso cargado por error;
- `GET/POST /api/caja/incomes/import`: migración histórica ADMIN.

La categoría `Venta` dentro de este modelo sigue siendo **otro ingreso histórico/manual**, no una venta de pedidos. No se suma a `Ventas` para evitar falsear el total de Orders.

### Importación histórica de otros ingresos

Formato esperado:

`Fecha, Tipo De Ingreso, Observación, Monto`

La migración es de una sola ejecución y crea el lock:

`cash_incomes_import_v1`

El resumen de Caja queda definido como:

```text
Ventas = Orders del período
Cobros de ventas = Payments PAID del período
Otros ingresos = CashIncome del período
Entró total = Cobros de ventas + Otros ingresos
Salidas = CashExpense del período
Flujo neto = Entró total - Salidas
```
