# Turnos

## Objetivo

El módulo `/turnos` permite programar el personal operativo de Alentó y controlar el costo de los turnos por mes.

No crea una segunda base de trabajadores. Usa exclusivamente los usuarios activos existentes en `User`.

## Acceso

Actualmente el módulo está disponible para el rol `ADMIN`.

Navegación:

- `src/components/AppShell.tsx`
- ruta: `/turnos`

## Persistencia

Modelo:

- `WorkShift`

Campos principales:

- `userId`: trabajador asociado.
- `startsAt`: fecha y hora de entrada.
- `endsAt`: fecha y hora de salida.
- `amount`: valor acordado del turno en COP.
- `status`: `PENDING` o `PAID`.
- `paidAt`: momento en que se marcó pagado.
- `notes`: observación opcional.
- `createdById` y `createdByName`: trazabilidad de creación.

## API

Listado mensual y creación:

- `GET /api/turnos?month=YYYY-MM`
- `POST /api/turnos`

Edición y eliminación:

- `PATCH /api/turnos/:id`
- `DELETE /api/turnos/:id`

El pago de turnos pendientes **no se registra directamente desde Turnos**. El flujo contable vigente es:

```text
Turnos PENDING
→ Caja
→ Salidas
→ Nómina
→ POST /api/caja/payroll
→ WorkShift PAID + CashExpense + PayrollPayment
```

El action histórico `toggle-payment` no debe usarse para pagar turnos pendientes: el backend lo bloquea y dirige el pago hacia Caja. Solo conserva compatibilidad para devolver a `PENDING` un registro pagado que no esté vinculado a un `PayrollPayment`.

## Reglas

- El trabajador debe ser un usuario activo.
- Entrada y salida son obligatorias.
- La salida debe ser posterior a la entrada.
- El valor no puede ser negativo.
- Un trabajador no puede tener dos turnos superpuestos.
- Un turno nuevo nace como `PENDING`.
- Los turnos pendientes se pagan desde Caja → Salidas → Nómina.
- Un turno incluido en un `PayrollPayment` no puede editarse, eliminarse ni volver manualmente a `PENDING` desde Turnos.
- Al pagar nómina, el sistema registra `paidAt` y cambia el turno a `PAID` dentro de la misma operación transaccional.

## Zona horaria

La operación se interpreta en `America/Bogota`.

El formulario convierte los valores `datetime-local` usando `-05:00` antes de enviarlos al servidor.

Los agrupamientos del calendario y las horas visibles también usan Bogotá.

## Resumen mensual

El API calcula:

- cantidad de turnos;
- valor programado;
- valor pagado;
- valor pendiente.

Los valores se calculan sobre los turnos cuyo inicio pertenece al mes consultado.

## Interfaz

Componente:

- `src/components/ShiftsManager.tsx`

Incluye:

- calendario mensual de lunes a domingo;
- color visual estable por trabajador;
- buscador;
- filtro por trabajador;
- filtro por estado de pago;
- resumen financiero;
- consolidado mensual;
- creación y edición en modal;
- eliminación;
- estado Pendiente/Pagado visible;
- consolidado por trabajador con saldo de préstamos;
- el pago real se completa desde Caja → Salidas → Nómina.

## Integración vigente con Nómina y Caja

Turnos es la fuente operativa de programación y costo por jornada. Nómina **ya está implementada** y consume `WorkShift`; no mantiene una segunda tabla de turnos.

Desde Caja:

- `GET /api/caja/payroll` lista turnos pendientes y préstamos recuperables;
- `POST /api/caja/payroll` paga uno o varios turnos del mismo trabajador;
- se pueden aplicar descuentos de préstamos asociados al trabajador y al período correspondiente;
- el pago crea un `CashExpense` con `source = PAYROLL`;
- se crea `PayrollPayment` y sus `PayrollPaymentShift`;
- los descuentos crean `CashLoanRepayment` con `source = PAYROLL`;
- los `WorkShift` seleccionados pasan a `PAID`;
- el comprobante queda disponible en `/caja/nomina/[id]/imprimir`.

Si una salida de nómina se elimina mientras la sesión de Caja correspondiente sigue abierta, la reversión debe ser transaccional: los turnos vuelven a pendientes y los descuentos de préstamo asociados se revierten. Después del cierre de Caja, el movimiento queda bloqueado.

Modelos relacionados:

- `WorkShift`;
- `PayrollPayment`;
- `PayrollPaymentShift`;
- `CashExpense`;
- `CashLoan`;
- `CashLoanRepayment`.

Documento contable relacionado: `docs/PAYMENTS_AND_CASH.md`.
