# Numeración global de pedidos

## Objetivo

Todos los canales comparten un único consecutivo numérico. El prefijo identifica el origen de la orden, pero no crea una secuencia independiente.

Ejemplo:

- `POS-0001`
- `WEB-0002`
- `POS-0003`
- `WEB-0004`

## Fuente del consecutivo

El número comercial ya no depende de `Order.id`.

El modelo `Order` conserva su `id` técnico interno, pero ahora tiene un campo independiente:

```prisma
sequenceNumber Int? @unique
```

El contador global se guarda en:

```prisma
model OrderSequence {
  id        Int      @id @default(1)
  current   Int      @default(0)
  updatedAt DateTime @updatedAt
}
```

Al crear un pedido, la aplicación incrementa `OrderSequence.current` y guarda el resultado en `Order.sequenceNumber` dentro de la misma transacción.

Esto evita duplicados si dos pedidos entran casi al mismo tiempo y permite que todos los canales compartan un solo consecutivo.

## Inicio oficial del sistema

La nueva secuencia comercial comienza desde cero.

Después de sincronizar Prisma, el primer pedido nuevo creado por el POS debe recibir:

`POS-0001`

El siguiente pedido, sin importar el canal, recibe `0002`:

- si entra por POS: `POS-0002`
- si entra por WEB: `WEB-0002`

Los pedidos anteriores a esta implementación pueden conservar `sequenceNumber = null`; no consumen la nueva secuencia comercial.

## Visualización en Pedidos

La pantalla `/pedidos` usa `Order.sequenceNumber` como número comercial cuando existe.

Ejemplo real:

- `Order.id = 12`
- `Order.sequenceNumber = 1`
- `Order.source = POS`

La interfaz muestra `POS-0001`; el `id = 12` sigue utilizándose únicamente para rutas internas y operaciones de API.

Como compatibilidad con registros creados antes de esta implementación, si un pedido histórico tiene `sequenceNumber = null`, la pantalla puede usar temporalmente `Order.id` como fallback visual.

## Visualización en Cocina

La pantalla `/cocina` también usa `Order.sequenceNumber` cuando existe, con el mismo prefijo derivado de `Order.source`.

Por ejemplo, un pedido con `id = 12`, `sequenceNumber = 1` y `source = POS` se muestra en Cocina como `POS-0001`. El `id` técnico continúa utilizándose internamente para actualizar productos y estados.

Los pedidos históricos sin `sequenceNumber` conservan un fallback visual al `Order.id` para compatibilidad.

## Prefijos

Actualmente:

- `POS` -> pedidos creados desde el punto de venta interno.
- `WEB` -> pedidos que más adelante se crearán desde la web del cliente.

El prefijo es independiente del número. Todos los canales consumen el mismo contador global.

## Regla sobre eliminaciones

Eliminar un pedido no reduce ni reutiliza el consecutivo global.

Ejemplo:

1. se crea `POS-0007`;
2. se elimina definitivamente;
3. el siguiente pedido será `POS-0008`, `WEB-0008` u otro prefijo según el canal;
4. `0007` no vuelve a asignarse.

Esto evita que dos pedidos diferentes tengan el mismo identificador comercial histórico.

## Cancelar vs eliminar

Son acciones diferentes:

- **Cancelar**: conserva la orden en PostgreSQL con estado `CANCELED`.
- **Eliminar**: borra definitivamente la orden, sus `OrderItem` y sus `Payment` relacionados.

La cancelación se usa cuando se quiere conservar historial operativo. La eliminación se usa cuando el registro debe desaparecer definitivamente, por ejemplo durante pruebas o correcciones autorizadas.

## Factura fiscal

El código `POS-0001` / `WEB-0002` es el identificador operativo del pedido. No debe confundirse con una numeración fiscal o electrónica autorizada. Si posteriormente se integra facturación electrónica, esa numeración debe manejarse como un concepto separado.
