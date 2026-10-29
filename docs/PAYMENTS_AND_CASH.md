# Pagos y Caja

Este documento define la diferencia entre el medio de pago elegido al crear una orden y el dinero realmente recibido por Alentó Pizza.

## Principio principal

Seleccionar `Efectivo`, `Nequi`, `DaviPlata`, `Tarjeta` o `Llave` en el cierre del POS NO significa que el ingreso ya entró a Caja.

Al crear el pedido:

- se guarda un `Payment` con el medio previsto;
- `Payment.status = PENDING`;
- `paidAt = null`;
- el pedido puede continuar su operación aunque el dinero todavía no esté registrado como recibido.

Caja conserva como entrada histórica todo cobro realmente recibido por `paidAt`.

Una devolución no borra ese ingreso original: se registra como un movimiento separado `PaymentRefund` por `refundedAt` y se descuenta del flujo neto de la fecha en que se devolvió el dinero.

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
- después de eliminar pagos erróneos sin devoluciones, una orden cerrada puede eliminarse definitivamente si las reglas del módulo lo permiten.

Esta acción es distinta a una devolución real al cliente. Si un pago ya tiene una devolución asociada, no puede eliminarse físicamente y el pedido tampoco puede eliminarse definitivamente: ambos deben conservarse para mantener el historial financiero.

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

Si una edición intenta bajar el total por debajo del dinero neto todavía recibido, el servidor la bloquea. Después de registrar una devolución suficiente, la edición puede continuar sin reescribir el cobro histórico.

## Eliminar pedido vs cancelar pedido

Son decisiones distintas:

- **Eliminar pedido**: borra físicamente la orden. Sus `OrderItem` y `Payment` relacionados se eliminan por `onDelete: Cascade`.
- **Cancelar pedido**: conserva la orden y la marca `CANCELED` para mantener historial.

Para borrar una orden cerrada con pagos registrados por error, primero deben poder eliminarse físicamente esos pagos. Si existe cualquier `PaymentRefund`, la eliminación definitiva del pedido queda bloqueada y solo puede conservarse como cancelado/finalizado.

## Caja

Ruta:

`/caja`

API principal:

`GET /api/caja/summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

`date=YYYY-MM-DD` sigue aceptándose como compatibilidad de un solo día.

Caja usa la zona horaria de Colombia y separa los conceptos comerciales de los movimientos reales de dinero.

### Fecha efectiva de venta

La fecha comercial de una venta es:

```text
pedido inmediato  → Order.createdAt
pedido programado → Order.scheduledFor
```

Por tanto:

- un pedido programado creado hoy para otra fecha **no aumenta las Ventas de hoy**;
- ese pedido aparece en Ventas del día para el que fue programado;
- reprogramarlo mueve su atribución comercial a la nueva fecha;
- Caja puede mostrar ventas programadas de una fecha futura aunque todavía no exista entrada real de dinero.

Conceptos del resumen:

- **Ventas**: suma de Orders cuya fecha efectiva de venta cae dentro del rango, excluyendo DRAFT y CANCELED.
- **Cobros de ventas**: suma cobros efectivamente recibidos por `paidAt` dentro del rango; incluye pagos que después hayan quedado completamente `REFUNDED`, para no alterar retrospectivamente el día del ingreso.
- **Otros ingresos**: suma de `CashIncome.amount` por `occurredAt` dentro del rango.
- **Entró total**: cobros de ventas + otros ingresos.
- **Salió**: suma de `CashExpense.amount` por `occurredAt` dentro del rango.
- **Devoluciones**: suma de `PaymentRefund.amount` por `refundedAt` dentro del rango.
- **Flujo neto**: entró total menos gastos, préstamos entregados y devoluciones, incorporando las recuperaciones aplicables.

También muestra:

- cantidad de pedidos vendidos;
- cantidad de pagos recibidos;
- distribución por medio de pago;
- distribución de salidas por categoría;
- movimientos recientes de ingresos;
- movimientos recientes de salidas.

No suma órdenes pendientes solo porque tengan un medio de pago seleccionado.

Para pedidos programados en otro día:

- el movimiento `PENDING` puede existir como medio previsto;
- registrar o eliminar un pago real queda bloqueado antes de la fecha programada;
- el día programado el cobro puede registrarse normalmente y entra a Caja por su `paidAt`;
- los estados de preparación/reparto siguen sujetos a la ventana operativa de 30 minutos.

Cuando un Payment se elimina físicamente, desaparece del resumen de Caja.

## Numeración de pedidos

La numeración operativa está documentada en:

`docs/ORDER_NUMBERING.md`

POS y WEB comparten la misma secuencia global de `Order.sequenceNumber`; solo cambia el prefijo visible.

## Próximas extensiones contables

Devoluciones auditables (`PaymentRefund` + `REFUNDED`) ya están implementadas.

El modelo puede continuar con:

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

Los cambios de esquema nuevos deben seguir la estrategia vigente de migraciones versionadas y `prisma migrate deploy`; no usar `db push` como rutina de producción.


## Devoluciones y cancelación después de recibir dinero

Endpoint:

`POST /api/orders/[id]/payment/[paymentId]/refund`

Cada devolución crea un `PaymentRefund` ligado al pago original. Guarda:

- valor devuelto;
- medio de devolución;
- motivo obligatorio;
- referencia opcional;
- fecha real `refundedAt`;
- colaborador responsable;
- clave/hash de idempotencia.

Reglas:

- soporta devolución parcial o total;
- nunca reescribe ni borra el cobro original;
- una devolución total cambia el pago original a `REFUNDED`;
- el saldo del pedido y las reglas de edición usan dinero **neto** recibido;
- un pago con devoluciones no puede eliminarse físicamente;
- cada refund genera `PAYMENT_REFUNDED` en Auditoría;
- Caja muestra la devolución como salida financiera separada de los gastos operativos.

Cancelación:

```text
neto recibido = 0 → se puede cancelar
neto recibido > 0 → bloquear cancelación y exigir devolución primero
```

Esto permite conservar simultáneamente la venta/cobro histórico, la salida por devolución y el estado final cancelado del pedido.

### Refund después de un pedido finalizado

El movimiento financiero de devolución puede registrarse sobre un pago histórico. Sin embargo, si el pedido ya alcanzó `COMPLETED`, Club Alentó pudo haber acreditado puntos de compra previamente.

La política de reversión de esos puntos todavía debe definirse explícitamente antes de cerrar el hardening #10. No inferir una reversión proporcional sin una regla comercial aprobada, porque `PaymentRefund.amount` no identifica qué líneas del pedido (producto, domicilio o componente no elegible) fueron objeto de la devolución.


## Salidas de Caja

Modelo:

`CashExpense`

Campos principales:

- `category`: tipo de salida;
- `subcategory`: subtipo opcional;
- `note`: observación;
- `amount`: monto;
- `occurredAt`: fecha/hora real de la salida;
- `source`: origen técnico/auditable del movimiento;
- `createdByName`: colaborador que registró el movimiento.

Rutas:

- `POST /api/caja/expenses`: registrar salida;
- `DELETE /api/caja/expenses/[id]`: eliminar una salida registrada por error.

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

## Otros ingresos de Caja

Modelo:

`CashIncome`

Se usa para entradas de dinero que no están asociadas a un `Payment` de un pedido, por ejemplo:

- ingresos de plataformas externas;
- retornos o ajustes de Wompi;
- préstamos;
- ventas históricas no facturadas/no registradas como Order;
- ajustes u otras entradas extraordinarias.

Campos:

- `category`: tipo de ingreso;
- `note`: observación;
- `amount`: monto;
- `occurredAt`: fecha/hora real de ingreso;
- `source`: origen técnico/auditable del movimiento;
- `createdByName`: responsable del registro.

Rutas:

- `POST /api/caja/incomes`: registrar otro ingreso;
- `DELETE /api/caja/incomes/[id]`: eliminar un ingreso cargado por error.

La categoría `Venta` dentro de este modelo sigue siendo **otro ingreso histórico/manual**, no una venta de pedidos. No se suma a `Ventas` para evitar falsear el total de Orders.

El resumen de Caja queda definido como:

```text
Ventas = Orders por fecha efectiva de venta
Cobros de ventas = Payments PAID por paidAt
Otros ingresos = CashIncome del período
Entró total = Cobros de ventas + Otros ingresos
Salidas = CashExpense del período
Flujo neto = Entró total - Salidas
```


## Préstamos y vales a trabajadores

Caja incorpora una cartera separada de préstamos/vales entregados a trabajadores.

Modelos:

- `CashLoan`: principal entregado, trabajador, fecha, estado, origen y responsable.
- `CashLoanRepayment`: abonos posteriores, fecha, monto, método y responsable.

Regla contable operativa:

```text
Flujo neto del período =
Cobros de ventas
+ Otros ingresos
+ Abonos recuperados de préstamos
- Salidas
- Nuevos préstamos entregados
```

Un préstamo **no es un gasto**: el dinero sale de disponibilidad y pasa a cartera por cobrar.

Un abono **no es un ingreso comercial**: recupera dinero previamente prestado y vuelve al flujo neto.

Los abonos pueden ser parciales. Métodos vigentes:

- `PAGO`: el trabajador devuelve el dinero.
- `DESCUENTO_NOMINA`: se recupera mediante descuento de nómina.

Algunos registros anteriores a la operación actual pueden estar marcados como pagados sin una fecha verificable de devolución. Esos registros se conservan para mantener la cartera correcta, pero no generan un movimiento sintético de Caja.


## Nómina integrada con Turnos

Nómina ya forma parte del flujo real de Caja.

Fuente de jornadas:

- `WorkShift` desde `/turnos`.

Carga pendiente:

- `GET /api/caja/payroll` lista turnos no pagados y préstamos pendientes asociados.

Pago:

- `POST /api/caja/payroll`;
- exige una sesión de Caja editable;
- selecciona uno o varios turnos pendientes del mismo trabajador;
- calcula bruto, descuentos de préstamos y neto;
- crea una salida `CashExpense` con `source = PAYROLL`;
- crea `PayrollPayment`;
- relaciona cada turno mediante `PayrollPaymentShift`;
- registra descuentos de préstamo como `CashLoanRepayment` con `source = PAYROLL`;
- marca los turnos `PAID` con `paidAt`;
- genera comprobante en `/caja/nomina/[id]/imprimir`.

Protecciones:

- un turno futuro no puede pagarse;
- un turno ya incluido en nómina no puede pagarse otra vez;
- descuentos de préstamos no pueden superar el bruto;
- los préstamos descontados deben corresponder al trabajador/período validado;
- un turno vinculado a `PayrollPayment` queda bloqueado contra edición/eliminación desde Turnos.

Reversión:

Si la salida de Nómina se elimina mientras la sesión de Caja correspondiente sigue abierta, la operación revierte transaccionalmente los turnos y los descuentos de préstamo. Después del cierre, el movimiento queda bloqueado.

Documento funcional: `docs/SHIFTS.md`.

## Cartera de repartidores

La cartera de repartidores se integra con pedidos y Salidas de Caja.

Configuración en `pos_settings.driverManagement`:

- `earningPercent`: porcentaje del domicilio cobrado al cliente que corresponde al repartidor, entre 0% y 100%;
- `freeDeliveryEarning`: incentivo fijo para pedidos cuyo `deliveryFee` sea $0.

Valores iniciales:

- porcentaje: 100%;
- entrega sin costo: $2.000.

Al marcar un domicilio como `DELIVERED`, el pedido congela:

- `deliveredAt`;
- `driverEarningAmount`;
- `driverEarningBase`;
- `driverEarningRatePercent`;
- `driverEarningKind`;
- `driverEarningCreditedAt`.

Cambiar la configuración después no modifica ganancias ya liquidadas.

La cartera se calcula como:

```text
Saldo disponible =
Ganancias de domicilios acreditadas
- Pagos registrados al repartidor en CashExpense
```

Los pagos se registran en Caja como:

- categoría: `Domicilios`;
- `driverId`: repartidor beneficiario;
- `source = DRIVER_PAYMENT`.

Caja bloquea pagos superiores al saldo disponible. Los pagos pueden ser parciales.

Eliminar una salida `DRIVER_PAYMENT` elimina también su efecto sobre la cartera, por lo que el monto vuelve automáticamente al saldo disponible.

Las salidas antiguas de Domicilios que no tengan `driverId` no afectan esta nueva cartera. Los pedidos anteriores a la activación pueden contar como entregas en Desempeño, pero no generan saldo retroactivo si no tienen una ganancia acreditada.


## Apertura: disponible + préstamos

La apertura se captura desde el **dinero disponible**, no desde el total controlado.

El operador ingresa:

```text
Dinero disponible
```

El sistema calcula automáticamente la cartera de préstamos pendiente al momento de abrir y forma:

```text
Total apertura =
Dinero disponible
+ Préstamos por cobrar
```

Persistencia:

- `openingBalance`: dinero disponible;
- `openingLoanReceivable`: préstamos por cobrar congelados al abrir;
- `openingControlledBalance`: suma de disponible + préstamos.

El valor sugerido desde el cierre anterior corresponde únicamente al **disponible real al cierre** (`actualClosingBalance`). La cartera de préstamos de la nueva apertura se consulta nuevamente y se suma por separado.

Esto evita pedir al operador que calcule o mezcle manualmente dinero disponible y cartera.

## Sesiones de caja: apertura → movimientos → cierre

Desde operación en producción, la unidad contable de Caja es una **sesión**, no el cambio de fecha del calendario.

Regla:

```text
Apertura (openedAt)
→ todos los movimientos operativos
→ Cierre (closedAt)
```

Una sesión puede cruzar medianoche. Ejemplo:

```text
25/09 17:34  Apertura
25/09 23:58  Venta
26/09 00:17  Salida
26/09 01:10  Cobro
26/09 01:25  Cierre
```

Los cuatro movimientos pertenecen a la misma sesión iniciada el 25/09.

`businessDate` identifica la fecha operativa en que se abrió la caja, pero **no limita los movimientos a 00:00–23:59**.

Para una sesión abierta, el resumen y el cierre calculan:

```text
openedAt <= movimiento < momento del cierre
```

Para una sesión cerrada:

```text
openedAt <= movimiento < closedAt
```

Mientras exista una sesión `OPEN`:

- al pasar medianoche no se crea automáticamente otra caja;
- la pantalla de Caja del día actual recupera la sesión que sigue abierta;
- cobros, ingresos, salidas, préstamos y abonos continúan perteneciendo a esa sesión;
- no se puede abrir una segunda caja antes de cerrar la existente.

En una consulta de **un solo día** sin sesión propia, Caja no hace fallback a `00:00–23:59`: muestra cero movimientos operativos. Esto evita que movimientos posteriores a medianoche, ya consumidos por la sesión anterior, vuelvan a aparecer en el día calendario siguiente. Los rangos de varios días sí permanecen disponibles como reporte calendario.

Fuera de una sesión abierta no se permiten nuevos movimientos operativos. Los intervalos de sesiones cerradas quedan bloqueados y no admiten alteraciones de movimientos.

Al cerrar una sesión que empezó el día anterior, la interfaz vuelve a seleccionar su `businessDate` para conservar visible el cuadre completo.

Caja muestra además un historial de aperturas y cierres con:

- fecha operativa;
- hora real de apertura;
- hora real de cierre;
- saldo esperado;
- saldo contado;
- diferencia del cierre.

Los movimientos operativos de producción se registran únicamente desde sus formularios y flujos normales dentro de Caja.


## Idempotencia y concurrencia de pagos

`POST /api/orders/[id]/payment` exige `Idempotency-Key`.

`Payment` conserva:

- `idempotencyKey` único;
- `idempotencyHash`.

La lógica canónica de escritura vive en:

`src/lib/orderPaymentRegistration.ts`

Dentro de la transacción, el pedido se bloquea mediante `SELECT ... FOR UPDATE` antes de recalcular el total pagado y el saldo.

Esto evita:

- doble pago por doble clic;
- duplicado por retry/timeout;
- dos terminales cobrando simultáneamente el mismo saldo.

La misma clave devuelve el mismo pago y no crea un segundo movimiento.

La prueba automatizada ejecuta dos cobros simultáneos por el saldo completo y verifica que solo uno termine como `PAID`.

Referencia: `docs/IDEMPOTENCY.md`.


## Auditoría financiera

Las operaciones sensibles de este módulo escriben en el Audit Log central:

- creación/eliminación de pagos;
- apertura, edición de apertura y cierre de Caja;
- ingresos/salidas;
- eliminación de ingresos/salidas;
- pagos de cartera a repartidores;
- préstamos y abonos;
- pago y reversión de nómina.

Los eventos se escriben dentro de la misma transacción de negocio cuando aplica.

El Audit Log es append-only y solo ADMIN puede consultarlo desde `/auditoria`.

Documento canónico: `docs/AUDIT_LOG.md`.
