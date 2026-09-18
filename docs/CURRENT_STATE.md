# Estado actual del proyecto

Última actualización: 2026-09-18.

Este documento resume el comportamiento vigente de Alentó App.

## Fase activa

**Punto de venta, Pedidos, Cocina y Clientes están cerrados para la etapa operativa actual.**

El bloque de trabajo actual es **Integraciones**, comenzando por Rappi.

```text
Rappi
→ onboarding Open Orders / Integrations Manager
→ recepción de pedido de prueba
→ Pedidos y Cocina
→ conciliación financiera
→ después DiDi
```

Menú y Autenticación/Roles continúan pendientes como bloques posteriores.

Referencias funcionales canónicas:

- `docs/POS.md`
- `docs/ORDERS.md`
- `docs/KITCHEN.md`

## Estado general

Alentó App ya funciona como sistema operativo interno para:

- POS;
- clientes;
- catálogo;
- pedidos;
- Cocina;
- pagos;
- Caja;
- cupones;
- configuración;
- impresión térmica.

Todavía no existe autenticación ni autorización por roles.

## Infraestructura

- Next.js 15 + React 19 + TypeScript.
- Tailwind CSS 4.
- Prisma 6 + PostgreSQL.
- EasyPanel/VPS.
- Proyecto EasyPanel: `app_alento`.
- Servicio: `alento-app`.
- Base: `alento-db`.
- URL temporal actual: `https://pos.alentopizza.com/`.

`alentopizza.com` continúa servido por Glide mientras se completa la migración futura.

## POS — cerrado

El POS soporta:

- Domicilio, Recoger y Local;
- búsqueda/creación/edición de clientes;
- pizzas de uno y dos sabores;
- tamaños;
- bordes;
- extras;
- combos;
- productos simples;
- descuentos/cupones;
- medios de pago;
- notas cortas por pizza;
- creación real de pedidos;
- consecutivo comercial global;
- recálculo server-side.

Las pizzas destacadas no duplican sabores en el configurador.

Ver `docs/POS.md`.

## Integridad estructurada

`OrderItem.configuration` es la fuente estructurada de lo vendido.

Pizzas conservan IDs y snapshots de tamaño, sabores, porciones, borde y extras.

Combos conservan producto padre, reglas, pizzas, grupos, opciones y cantidades.

`OrderItem.notes` guarda instrucciones breves de preparación por pizza, máximo 120 caracteres.

Ver `docs/ORDER_DATA_INTEGRITY.md`.

## Pedidos — cerrado

`/pedidos` permite:

- buscar y filtrar;
- consultar detalle;
- editar modalidad;
- editar cantidades;
- agregar productos;
- agregar pizzas/combos configurados;
- editar notas;
- actualizar el mismo cliente;
- reasignar cliente;
- registrar pagos;
- pagos parciales;
- eliminar pagos por error;
- imprimir;
- cancelar;
- eliminar definitivamente bajo reglas de día operativo;
- continuar estados después de Cocina.

La tarjeta compacta muestra un único estado financiero actual: `PAGO PENDIENTE` o `PAGADO`.

Ver `docs/ORDERS.md`.

## Clientes — cerrado por ahora

`/clientes` incluye:

- búsqueda y filtros por estado;
- estados comerciales con color;
- compras, ticket promedio y total comprado;
- perfil detallado;
- frecuencia, primera/última compra y días sin comprar;
- historial estructurado de pedidos;
- impresión de copias térmicas desde el historial;
- edición;
- eliminación individual;
- importación/exportación CSV;
- plantilla oficial de importación;
- eliminación masiva de clientes sin pedidos;
- permiso para eliminación masiva controlado desde Configuración.

Ver `docs/CUSTOMERS.md`.

## Cocina — cerrada

`/cocina`:

- muestra hasta 3 pedidos por fila en escritorio;
- prioriza pizzas, luego antojos;
- excluye bebidas;
- usa `preparedQuantity`;
- pasa automáticamente a `PREPARED`;
- permite `PREPARED → READY`;
- muestra tiempo transcurrido;
- muestra cliente de forma sutil;
- jerarquiza tamaño, borde, sabores, extras y nota;
- muestra notas en mayúsculas visuales;
- oculta controles cuando una línea ya está preparada.

Ver `docs/KITCHEN.md`.

## Integraciones — en desarrollo

`/integraciones` ya contiene la base de Rappi y DiDi.

Para Rappi:

- no se almacenan credenciales de Rappi Partners;
- se prepara conexión mediante credenciales técnicas Open Orders/Integrations Manager;
- se conserva ID de tienda;
- existe estado real de conexión: no conectada, pendiente, conectada o error;
- la verificación se realiza desde servidor contra la autenticación Open Orders;
- los pedidos marketplace conservarán el valor exacto recibido en la orden/factura;
- Pedidos ya está preparado para mostrar el origen marketplace y el valor de factura;
- `MarketplaceOrder` aporta idempotencia por proveedor + ID externo.

Este bloque requiere `npx prisma db push` por el nuevo modelo y enums.

Ver `docs/INTEGRATIONS.md`.

## Flujo de estados

Domicilio:

```text
PREPARING → PREPARED → READY → OUT_FOR_DELIVERY → ARRIVED → DELIVERED → COMPLETED
```

Recoger / Local:

```text
PREPARING → PREPARED → READY → COMPLETED
```

## Pagos y Caja

Seleccionar un medio en POS no significa dinero recibido.

- `PENDING`: intención/medio previsto.
- `PAID`: dinero realmente recibido.

Caja contabiliza únicamente pagos `PAID`.

Si una orden aumenta después de un pago recibido, se conserva el ingreso y aparece saldo por la diferencia.

## Consecutivo comercial

`Order.id` es técnico.

La identidad comercial usa `Order.sequenceNumber` + `Order.source`.

Ejemplos:

```text
POS-0001
POS-0002
WEB-0003
```

POS, Pedidos, Cocina e impresión utilizan el mismo código comercial.

## Impresión

Existe comprobante térmico de 80 mm en:

`/pedidos/[id]/imprimir`

Incluye configuración estructurada y notas de Cocina.

No es facturación electrónica fiscal.

## Autenticación y roles — siguiente fase

Actualmente no existe:

- modelo `User`;
- login;
- contraseña/hash;
- sesión;
- middleware de protección;
- autorización por rol;
- protección de APIs internas.

Roles previstos:

- `ADMIN`
- `POS`
- `KITCHEN`
- `CASHIER`
- `DISPATCH`

Ver `docs/AUTH_ROLES_AND_PUBLIC_APP.md`.

## Prisma

Producción usa manualmente:

```bash
npx prisma db push
```

No usar `prisma migrate deploy` hasta realizar un baseline formal.

Los cierres de POS, Pedidos y Cocina documentados aquí no requieren un cambio adicional de schema.

## Próximos pasos

1. Implementar `User` y roles.
2. Elegir solución de autenticación.
3. Implementar login/logout y sesión.
4. Proteger páginas internas.
5. Proteger APIs internas.
6. Aplicar permisos por rol.
7. Crear administración de usuarios.
8. Continuar Caja/cierres.
9. Inventario, recetas y costos.
10. Integraciones y experiencia pública.
