# Numeración global de pedidos

## Objetivo

Todos los canales comparten un único consecutivo numérico. El prefijo identifica el origen de la orden, pero no crea una secuencia independiente.

Ejemplo:

- `POS-0001`
- `WEB-0002`
- `POS-0003`
- `WEB-0004`

## Fuente del consecutivo

El número se basa en `Order.id`, generado por PostgreSQL.

Esto significa que POS, WEB y los canales futuros consumen la misma secuencia global de `Order`.

El helper central está en:

`src/lib/orderCode.ts`

Uso:

```ts
orderCode(order.id, order.source)
```

## Prefijos

Actualmente:

- `POS` -> pedidos creados desde el punto de venta interno.
- `WEB` -> pedidos que más adelante se crearán desde la web del cliente.

El helper también contempla abreviaciones para otros `OrderSource`, pero POS y WEB son los prefijos comerciales principales definidos en esta etapa.

## Regla sobre eliminaciones

Eliminar un pedido borra físicamente la fila `Order` y, por relaciones `onDelete: Cascade`, elimina también sus `OrderItem` y `Payment` relacionados.

PostgreSQL no reutiliza automáticamente un `id` eliminado. Por seguridad operativa, un número que ya existió no se reasigna a otro pedido.

Ejemplo:

1. existe `POS-0007`;
2. se elimina definitivamente;
3. el siguiente pedido puede ser `POS-0008` o `WEB-0008` según el canal;
4. `0007` no se reutiliza.

Esto evita que dos pedidos distintos hayan tenido el mismo identificador histórico.

## Cancelar vs eliminar

Son acciones diferentes:

- **Cancelar**: conserva la orden en PostgreSQL con estado `CANCELED`.
- **Eliminar**: borra definitivamente la orden y sus relaciones en cascada.

La cancelación se usa cuando se quiere conservar el historial operativo. La eliminación se usa cuando el registro debe desaparecer definitivamente, por ejemplo durante pruebas o correcciones autorizadas.

## Factura fiscal

El código `POS-0001` / `WEB-0002` es el identificador operativo del pedido. No debe confundirse con una numeración fiscal o electrónica autorizada. Si posteriormente se integra facturación electrónica, esa numeración debe manejarse como un concepto separado.
