# Clientes

Estado: **EN DESARROLLO / NUEVO PANEL COMERCIAL**

Ruta: `/clientes`

## Objetivo

Clientes deja de ser únicamente un directorio y pasa a funcionar como un panel de seguimiento comercial y retención.

El módulo debe permitir:

- encontrar clientes rápidamente;
- entender cuánto compran;
- saber cuándo compraron por última vez;
- conocer su ticket promedio;
- estimar frecuencia de compra;
- detectar oportunidades de recuperación;
- consultar historial de pedidos;
- editar datos sin perder trazabilidad.

## Métricas

Las métricas actuales se calculan con pedidos cuyo estado no sea `CANCELED`.

Por cliente se calculan:

- número de compras;
- venta acumulada;
- ticket promedio;
- primera compra;
- última compra;
- días desde última compra;
- frecuencia promedio entre pedidos.

### Frecuencia

Cuando existen al menos dos compras:

```text
frecuencia promedio =
(días entre primera y última compra)
÷
(cantidad de compras - 1)
```

La frecuencia se expresa aproximadamente como:

`Cada N días`

## Señal comercial

El panel clasifica visualmente al cliente con una señal simple.

### Sin compras

No tiene pedidos válidos.

### Nuevo

Tiene exactamente una compra.

### Activo

Tiene más de una compra y todavía no alcanza el criterio de cliente frecuente.

### Frecuente

Tiene cuatro o más compras y no se encuentra fuera de su patrón de recompra.

### Por recuperar

Un cliente con al menos dos compras entra inicialmente en esta categoría cuando los días desde la última compra superan:

```text
max(21 días, frecuencia histórica × 1.6)
```

Esta regla es heurística y puede ajustarse posteriormente con mayor volumen de datos.

No representa una predicción probabilística de compra.

## Resumen general

El módulo muestra:

- compras registradas;
- venta acumulada;
- ticket promedio global;
- clientes por recuperar.

## Tarjetas

Cada cliente muestra:

- inicial;
- nombre;
- teléfono;
- señal comercial;
- número de compras;
- ticket promedio;
- total comprado;
- última compra;
- días desde última compra;
- dirección principal o correo;
- acceso al perfil;
- edición.

La tarjeta completa es seleccionable.

## Perfil del cliente

Al hacer clic se abre un drawer con:

- información personal;
- teléfonos/correo;
- direcciones;
- notas;
- compras;
- ticket promedio;
- total comprado;
- frecuencia;
- primera compra;
- última compra;
- días sin comprar;
- historial de pedidos.

## Historial

Cada pedido muestra:

- código comercial;
- modalidad;
- estado;
- fecha/hora;
- total;
- productos principales.

El código usa la misma lógica global de POS, Pedidos y Cocina mediante `orderCode`.

## Edición

La edición existente se mantiene.

Permite actualizar:

- nombre;
- indicativo;
- teléfono;
- dirección principal;
- correo;
- notas.

Actualizar el cliente no elimina ni separa su historial.

## Eliminación

Un cliente con pedidos asociados no puede eliminarse.

Esto protege la trazabilidad de las órdenes.

## Backend

### GET /api/customers?all=1

Además de datos de contacto devuelve `metrics`:

- `purchaseCount`;
- `totalSpent`;
- `averageTicket`;
- `firstOrderAt`;
- `lastOrderAt`;
- `frequencyDays`.

### GET /api/customers/[id]

Devuelve:

- cliente;
- direcciones;
- métricas;
- historial de pedidos;
- productos de cada pedido.

## Archivos principales

- `src/app/clientes/page.tsx`
- `src/app/api/customers/route.ts`
- `src/app/api/customers/[id]/route.ts`
- `src/lib/orderCode.ts`
- `src/lib/orderWorkflow.ts`

## Prisma

Este bloque utiliza relaciones que ya existen entre `Customer` y `Order`.

No requiere `npx prisma db push`.
