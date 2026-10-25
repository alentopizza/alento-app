# Clientes

Estado: **CERRADO PARA LA ETAPA OPERATIVA ACTUAL**

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

## Filtros y lectura del listado

La cabecera de Clientes separa explícitamente dos dimensiones para evitar mezclar conceptos:

### Estado de dirección

- Todas;
- Verificadas;
- Por actualizar;
- Sin dirección.

### Estado comercial

- Todos;
- Nuevo;
- Activo;
- Frecuente;
- Por recuperar;
- Sin compras.

Ambos grupos muestran contadores y pueden combinarse con el buscador.

Reglas visuales vigentes:

- no mezclar los estados de dirección y comerciales en una única fila sin contexto;
- cada grupo debe tener su título visible;
- los botones usan tamaño de control normal, no microtexto;
- icono, etiqueta y contador deben poder leerse sin depender únicamente del color;
- el filtro activo conserva contraste suficiente sin reducir legibilidad de los demás estados.

Los contadores se calculan sobre todos los clientes cargados. El buscador se combina con ambos filtros seleccionados.

## Tarjetas

Cada cliente muestra, en este orden de lectura:

1. inicial, nombre y teléfono;
2. señal comercial;
3. dirección principal;
4. estado de validación de la dirección;
5. número de compras, ticket promedio y total comprado.

La jerarquía visual debe priorizar nombre y estado. Las etiquetas de estado, dirección y métricas usan la escala tipográfica operativa (`alento-ui-label` / `alento-ui-control` / `alento-ui-body`) y no deben volver a microtexto difícil de leer.

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
- productos;
- cantidades;
- tamaño;
- borde;
- sabores;
- extras;
- notas de preparación;
- total por producto;
- acción para imprimir una copia del comprobante térmico.

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

La edición usa un modal operativo más amplio y organizado por secciones. Para la dirección:

- se busca primero una referencia con Google Places;
- después se muestra el mapa con el pin oficial de domicilio;
- el pin es draggable y permite ajustar manualmente el punto exacto aunque Google no encuentre el número preciso;
- al soltar el pin se hace reverse geocoding server-side, se actualiza la dirección visible y se recalculan ruta, cobertura y tarifa;
- el punto guardado es la coordenada final elegida por el operador;
- barrio e indicaciones continúan editables manualmente.

Actualizar el cliente no elimina ni separa su historial.

## Eliminación masiva

El listado permite activar `Selección múltiple`.

Reglas:

- solo son seleccionables para eliminación masiva los clientes con `0 pedidos`;
- los clientes con pedidos aparecen bloqueados;
- se puede seleccionar todos los clientes elegibles visibles según búsqueda/filtro;
- antes de borrar aparece una confirmación irreversible;
- el endpoint vuelve a validar que cada cliente tenga `0 pedidos` antes de eliminarlo;
- máximo 500 clientes por operación.

Endpoint:

`POST /api/customers/bulk-delete`

## Eliminación individual

Un cliente puede eliminarse incluso si tiene pedidos asociados.

Como la relación `Order.customerId` usa `onDelete: SetNull`, los pedidos se conservan y únicamente pierden la asociación al cliente eliminado.

La interfaz muestra una confirmación explícita cuando el cliente tiene historial para dejar claro que los pedidos permanecerán en el sistema.

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

### Plantilla

El modal de importación ofrece una plantilla descargable:

`template-clientes-alento.csv`

Incluye las columnas esperadas y una fila de ejemplo para reducir errores de formato antes de cargar una base real.

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


## Cierre del módulo

Clientes se considera **cerrado para la etapa operativa actual**.

Quedan operativos:

- directorio con búsqueda;
- clasificación comercial por estado;
- filtros con contador;
- métricas por cliente;
- perfil detallado;
- historial estructurado de compras;
- impresión de copias de pedidos;
- edición individual;
- eliminación individual;
- importación CSV con validación y plantilla;
- exportación CSV;
- eliminación masiva protegida por configuración;
- permiso de eliminación masiva controlado desde Configuración.

El módulo puede recibir correcciones de bugs, pero no debe reabrirse como fase de diseño sin una solicitud explícita.


## Sincronización de contactos nuevos

Alentó puede enviar los clientes nuevos a un escenario externo de Make para crear o sincronizar el contacto en Google Contacts.

Variable de producción:

```text
CUSTOMER_CREATED_WEBHOOK_URL=<webhook privado de Make>
```

La URL real no se guarda en Git.

### Clientes incluidos

Se marca el envío para:

- clientes creados manualmente desde Clientes/POS;
- clientes creados durante un checkout web;
- clientes creados por registro OTP;
- clientes temporales con nombre `NUEVO` cuando posteriormente reciben un nombre real.

La importación CSV histórica **no** marca clientes para este webhook.

### Control de entrega

`Customer` conserva:

- `contactWebhookPending`: el contacto debe enviarse;
- `contactWebhookSentAt`: momento de la entrega exitosa.

Si el webhook falla, la creación del cliente no falla. El estado queda pendiente para un reintento en una interacción posterior compatible.

Un cliente con nombre `NUEVO` no se envía hasta contar con un nombre real.

### Payload

Make recibe JSON con esta estructura:

```json
{
  "evento": "cliente.registrado",
  "clienteId": 123,
  "nombre": "Cliente Ejemplo",
  "indicativo": "+57",
  "telefono": "3001234567",
  "telefonoCompleto": "+573001234567",
  "origen": "STAFF",
  "registradoEn": "2026-10-02T15:00:00.000Z"
}
```

`origen` puede ser:

- `STAFF`;
- `WEB_CHECKOUT`;
- `CUSTOMER_ACCOUNT`.

El helper central es `src/lib/customerContactWebhook.ts`.
