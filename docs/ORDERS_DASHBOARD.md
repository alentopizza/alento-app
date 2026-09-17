# Dashboard de Pedidos

La ruta `/pedidos` usa una vista de tarjetas compactas orientada a operación rápida.

## Objetivo

La pantalla evita duplicar una misma orden en varios bloques. Cada pedido aparece una sola vez y muestra únicamente la información necesaria para identificarlo y actuar sobre su estado actual.

## Header

La página usa un hero oscuro consistente con el POS:

- etiqueta `Operación`;
- título `Pedidos`;
- texto `Una orden, un estado actual y una acción clara.`;
- contador de pedidos activos;
- botón de actualización manual.

## Búsqueda y filtros

El dashboard permite buscar por:

- código ALT;
- cliente;
- teléfono;
- estado;
- modalidad.

Filtros rápidos:

- Todos;
- Activos;
- Finalizados;
- Cancelados.

La información se actualiza automáticamente cada 15 segundos.

## Tarjeta de pedido

Cada tarjeta muestra:

- estado actual;
- modalidad: Domicilio, Recoger o Local;
- fecha y hora;
- código `ALT-xxxxxx`;
- cantidad de líneas y unidades;
- cliente y teléfono;
- dirección cuando aplica;
- total;
- forma de pago;
- impresión térmica 80 mm;
- acceso al detalle;
- una sola acción operativa principal.

### Acción principal

Mientras el pedido esté en `CONFIRMED`, `PREPARING` o `PREPARED`, la acción visible es `Gestionar en Cocina`.

Desde `READY` en adelante se calcula el siguiente estado permitido con `nextStatus()` y se muestra únicamente esa acción.

Los pedidos `COMPLETED` o `CANCELED` no muestran acciones operativas pendientes.

## Detalle lateral

Al hacer click sobre una tarjeta se abre un drawer lateral con:

- fecha;
- estado actual;
- cliente;
- teléfono;
- modalidad;
- dirección y zona;
- productos con configuración estructurada;
- tamaño;
- borde;
- sabores;
- extras;
- componentes de combos;
- subtotal;
- domicilio;
- descuentos;
- total;
- forma de pago;
- efectivo recibido y vueltas;
- impresión 80 mm;
- acción operativa actual.

La tarjeta principal permanece compacta y el detalle completo solo aparece bajo demanda.

## Archivos principales

- `src/app/pedidos/page.tsx`
- `src/components/OrdersCardsDashboard.tsx`
- `src/lib/orderWorkflow.ts`
- `src/lib/orderPresentation.ts`
- `src/app/api/orders/[id]/status/route.ts`

## Base de datos

Este cambio es de interfaz y reutiliza la API y el workflow existentes. No agrega tablas, columnas ni enums nuevos.

No requiere `prisma db push`.
