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

Edición, pago y eliminación:

- `PATCH /api/turnos/:id`
- `DELETE /api/turnos/:id`

Para cambiar el estado de pago:

```json
{
  "action": "toggle-payment"
}
```

## Reglas

- El trabajador debe ser un usuario activo.
- Entrada y salida son obligatorias.
- La salida debe ser posterior a la entrada.
- El valor no puede ser negativo.
- Un trabajador no puede tener dos turnos superpuestos.
- Un turno nuevo nace como `PENDING`.
- Cambiar a `PAID` registra `paidAt`.
- Regresar a `PENDING` limpia `paidAt`.

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
- cambio rápido Pendiente/Pagado.

## Relación futura con Nómina

Turnos es la fuente operativa de programación y costo por jornada.

Si se crea un módulo de Nómina, debe consumir `WorkShift` en lugar de duplicar turnos o valores en otra tabla.
