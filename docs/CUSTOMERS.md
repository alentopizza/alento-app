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

## Filtros por estado

El listado permite filtrar por señal comercial y muestra el número de clientes en cada estado:

- Todos;
- Nuevo;
- Activo;
- Frecuente;
- Por recuperar;
- Sin compras.

Los contadores se calculan sobre todos los clientes cargados. El buscador se combina con el filtro seleccionado.

## Tarjetas

Cada cliente muestra:

- inicial;
- nombre;
- teléfono;
- dirección principal;
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

## Importar y exportar

El módulo permite administrar bases existentes de clientes mediante CSV.

### Importar

Desde el header de Clientes existe la acción `Importar`.

Flujo:

```text
Seleccionar CSV
→ analizar
→ normalizar
→ validar
→ detectar duplicados
→ mostrar vista previa
→ confirmar
→ crear solo clientes nuevos
```

La importación acepta directamente columnas como:

- `Cliente/Nombre`
- `Cliente/Indicativo`
- `Cliente/Telefono`
- `Cliente/Correo`
- `Cliente/Dirección`
- `Cliente/Complemento`
- `Cliente/GPS Link`
- `Cliente/Notas`

También reconoce nombres simples equivalentes como `Nombre`, `Telefono`, `Dirección`, `Email`, etc.

El teléfono se normaliza a dígitos para que valores como:

```text
300 486 4538
3004864538
```

se consideren el mismo cliente.

Los duplicados se detectan:

- dentro del mismo archivo por teléfono;
- dentro del mismo archivo por correo;
- contra clientes existentes por teléfono;
- contra clientes existentes por correo.

Los clientes existentes se **omiten** y no se sobrescriben automáticamente. Esto protege su historial y evita reasignar pedidos accidentalmente.

Antes de importar se muestra:

- total de filas;
- clientes nuevos;
- filas omitidas;
- vista previa;
- motivo de cada omisión.

La operación final crea todos los clientes nuevos dentro de una transacción.

El límite actual de archivo es 5 MB.

### Dirección y complemento

`Cliente/Dirección` se guarda como dirección principal.

`Cliente/Complemento` se conserva como nota de la dirección.

Si existe `Cliente/GPS Link`, también se conserva dentro de la nota de dirección para no perder información de la base anterior.

### Exportar

La acción `Exportar` descarga la base actual en:

`clientes-alento.csv`

Columnas:

- nombre;
- indicativo;
- teléfono;
- correo;
- dirección principal;
- complemento/notas de dirección;
- notas del cliente.

El archivo usa UTF-8 con BOM para abrir correctamente tildes y caracteres especiales en Excel.

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
- `src/app/api/customers/import/route.ts`
- `src/app/api/customers/export/route.ts`
- `src/lib/customerCsv.ts`
- `src/lib/orderCode.ts`
- `src/lib/orderWorkflow.ts`

## Prisma

Este bloque utiliza relaciones que ya existen entre `Customer` y `Order`.

No requiere `npx prisma db push`.
