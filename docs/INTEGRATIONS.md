# Integraciones

Estado: **BASE FUNCIONAL CREADA / CONEXIONES REALES PENDIENTES**

Ruta: `/integraciones`

## Objetivo

Centralizar las conexiones con plataformas externas de delivery sin crear un flujo operativo paralelo.

La arquitectura objetivo es:

```text
Rappi / DiDi
→ webhook o API oficial
→ adaptador Alentó
→ Order / OrderItem
→ Pedidos
→ Cocina
```

El equipo debe poder operar los pedidos externos desde las mismas pantallas de Alentó.

## Proveedores iniciales

- Rappi
- DiDi Food

La interfaz está preparada para agregar más proveedores.

## Estados

Cada integración puede mostrarse como:

- `Sin configurar`
- `Pendiente`
- `Activa`

No se debe marcar una integración como activa hasta que exista conexión real y confirmada con el proveedor.

## Configuración actual

Por proveedor se guarda:

- si se está preparando la integración;
- identificador/referencia de tienda;
- modo de ingreso:
  - revisión manual;
  - autoaceptación cuando el proveedor lo permita;
- estado real de conexión:
  - `No conectada`;
  - `Pendiente`;
  - `Conectada`;
  - `Error`;
- última verificación;
- último error de conexión, si existe.

La configuración se guarda en `AppSetting` con clave:

`integrations_settings`

## Seguridad

Tokens, secretos, firmas y credenciales privadas **no** se guardan desde la interfaz ni en campos visibles.

Cuando existan credenciales oficiales:

- deben configurarse en servidor;
- deben usar variables de entorno o un almacén seguro;
- no deben exponerse al cliente;
- webhooks deben validarse con firma/secret cuando el proveedor lo soporte.

## Rappi

Rappi dispone de un sistema oficial de integración llamado Open Orders y un Integrations Manager para integradores.

La cuenta de Rappi Partners y su contraseña **no son credenciales de API** y no deben almacenarse en Alentó.

Requisitos:

- tienda activa en Rappi Partners;
- ID de tienda;
- habilitación oficial de integración POS/Open Orders;
- credenciales técnicas entregadas por Rappi;
- mapeo de productos/modificadores;
- endpoint/webhook;
- pruebas antes de producción.

Variables previstas:

```text
RAPPI_CLIENT_ID
RAPPI_CLIENT_SECRET
RAPPI_API_BASE_URL
RAPPI_WEBHOOK_SECRET
```

`RAPPI_API_BASE_URL` debe usar el dominio asignado por Rappi para el entorno correspondiente.

El botón **Conectar Rappi** guarda primero el ID de tienda y luego intenta autenticarse contra:

```text
POST {RAPPI_API_BASE_URL}/restaurants/auth/v1/token/login/integrations
```

Si Rappi devuelve un token válido, la integración queda marcada como `Conectada` y se registra la hora de verificación.

Los productos se intentarán vincular primero por nombre normalizado, porque el catálogo de Alentó y Rappi usa nombres equivalentes. Antes de producción se deben revisar manualmente tamaños, bordes, toppings y cualquier excepción.

## DiDi Food

Requisitos previstos:

- tienda activa;
- autorización de Open Platform/integración para la cuenta;
- identificador de tienda;
- credenciales;
- mapeo de productos/modificadores;
- pruebas y activación.

## Pedidos externos

La integración crea pedidos normales de Alentó, no un flujo operativo paralelo.

El schema ya contempla `MarketplaceOrder`, relacionado 1:1 con `Order`, para conservar:

- ID externo del pedido;
- proveedor;
- ID de tienda;
- valor exacto de factura;
- timestamp de recepción;
- payload mínimo para trazabilidad;
- idempotencia mediante `provider + externalOrderId`.

Los pedidos usan nuevos orígenes:

- `RAPPI` → prefijo visible `RAP-`
- `DIDI` → prefijo visible `DID-`

### Valor exacto del pedido

Alentó no calcula comisiones ni netos dentro del flujo de pedidos Rappi.

El pedido debe conservar exactamente el valor que Rappi entrega en la orden:

- `Order.total` = total real recibido en el pedido;
- `MarketplaceOrder.invoiceAmount` = valor de factura recibido del marketplace.

Ese valor es el que se muestra en Pedidos y en el comprobante térmico.

No se usan porcentajes manuales ni estimaciones de comisión en esta pantalla.

## Próximos pasos

1. validar acceso oficial de Rappi;
2. validar acceso oficial de DiDi;
3. definir modelo de persistencia para IDs externos e idempotencia;
4. implementar primer adaptador;
5. crear webhook seguro;
6. mapear productos;
7. recibir pedido de sandbox/prueba;
8. confirmar entrada a Pedidos y Cocina;
9. sincronizar estados de vuelta al proveedor.

## Archivos

- `src/app/integraciones/page.tsx`
- `src/app/api/integrations/route.ts`
- `src/components/AppShell.tsx`

## Prisma

La preparación de marketplace agrega:

- valores `RAPPI` y `DIDI` a `OrderSource`;
- enum `MarketplaceProvider`;
- modelo `MarketplaceOrder`;
- relación 1:1 `Order.marketplaceOrder`.

Este bloque **sí requiere**:

```bash
npx prisma db push
```

Revisar el cambio antes de ejecutarlo en producción, siguiendo `docs/DEPLOYMENT.md`.


## Flujo OAuth tipo popup

Alentó implementa el mismo patrón visual observado en POS ya integrados con Rappi:

```text
Conectar Rappi
→ popup con login oficial de Rappi
→ Rappi devuelve autorización a Alentó
→ Alentó consulta las tiendas autorizadas
→ modal "Seleccionar tienda de Rappi"
→ Integrar
→ estado CONECTADA
```

Rutas implementadas:

- `GET /api/integrations/rappi/oauth/start`
- `GET /api/integrations/rappi/oauth/callback`
- `POST /api/integrations/rappi/oauth/complete`

La contraseña del comercio nunca pasa por Alentó. El login se realiza en dominio Rappi.

### Variables requeridas

```text
RAPPI_OAUTH_CLIENT_ID
RAPPI_OAUTH_CLIENT_SECRET
RAPPI_OAUTH_AUTHORIZE_URL
RAPPI_OAUTH_TOKEN_URL
RAPPI_OAUTH_STORES_URL
RAPPI_OAUTH_CALLBACK_URL
RAPPI_OAUTH_SCOPE
RAPPI_OAUTH_AUDIENCE
```

El callback configurado para producción debe ser:

```text
https://pos.alentopizza.com/api/integrations/rappi/oauth/callback
```

### Limitación externa

El flujo ya está implementado en Alentó, pero Rappi debe registrar/habilitar a Alentó como integración y emitir los valores OAuth correspondientes.

No se debe reutilizar el `client_id`, callback o secretos de otro POS/integrador.

El portal Integrations Manager de Rappi usa su propio cliente y callback, por lo que abrir ese portal no vincula automáticamente una tienda con Alentó.
