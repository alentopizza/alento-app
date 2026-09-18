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
- estado de integración.

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

Requisitos previstos:

- tienda activa;
- autorización oficial para integración POS/API;
- identificador de tienda;
- credenciales;
- mapeo de productos/modificadores;
- endpoint/webhook;
- pruebas antes de producción.

## DiDi Food

Requisitos previstos:

- tienda activa;
- autorización de Open Platform/integración para la cuenta;
- identificador de tienda;
- credenciales;
- mapeo de productos/modificadores;
- pruebas y activación.

## Pedidos externos

La integración futura debe crear pedidos normales de Alentó, no entidades paralelas.

Se deberá conservar:

- ID externo del pedido;
- proveedor;
- tienda externa;
- estado externo;
- timestamps de recepción;
- payload mínimo necesario para trazabilidad;
- idempotencia para evitar duplicados.

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

La base inicial usa `AppSetting`, que ya existe.

No requiere `npx prisma db push`.

La conexión real probablemente requerirá modelos específicos para referencias externas, eventos e idempotencia. Ese cambio se diseñará cuando se elija el primer proveedor a implementar.
