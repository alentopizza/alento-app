# Handoff y continuidad del proyecto

Este documento existe para que una nueva persona, desarrollador o IA pueda retomar Alentó App sin depender del historial de una conversación anterior.

## Lectura obligatoria al retomar

Leer en este orden:

1. `README.md`
2. `docs/CURRENT_STATE.md`
3. `docs/ROADMAP.md`
4. `docs/POS.md`
5. `docs/ORDERS.md`
6. `docs/KITCHEN.md`
7. `docs/ARCHITECTURE.md`
8. `docs/AUTH_ROLES_AND_PUBLIC_APP.md`
9. `docs/ORDER_NUMBERING.md`
10. `docs/PAYMENTS_AND_CASH.md`
11. `docs/ORDER_DATA_INTEGRITY.md`
12. `docs/DEPLOYMENT.md`
13. `prisma/schema.prisma`
14. Los archivos del módulo que se vaya a modificar.

Después revisar commits recientes de `main`.

## Regla obligatoria de documentación

Todo cambio funcional o estructural importante debe quedar documentado en el mismo bloque de trabajo.

Como mínimo:

- actualizar `docs/CURRENT_STATE.md` cuando cambie el comportamiento real;
- actualizar `docs/ARCHITECTURE.md` cuando cambie una regla estructural;
- actualizar `docs/AUTH_ROLES_AND_PUBLIC_APP.md` cuando cambien autenticación, permisos, dominio o app pública;
- actualizar `docs/ORDER_NUMBERING.md` cuando cambie el consecutivo o identificación comercial;
- actualizar `docs/PAYMENTS_AND_CASH.md` cuando cambien pagos, Caja o conciliación;
- actualizar `docs/ORDER_DATA_INTEGRITY.md` cuando cambie cómo se representa un producto vendido;
- actualizar `docs/DEPLOYMENT.md` cuando cambie Prisma, EasyPanel, variables de entorno o procedimiento de despliegue;
- actualizar `README.md` cuando cambie el objetivo o roadmap general.

No considerar una funcionalidad importante terminada hasta actualizar su documentación.

## Estado conceptual actual

Alentó App es la fuente operativa principal en construcción.

Debe terminar centralizando:

- POS;
- clientes;
- catálogo;
- pedidos;
- Cocina;
- pagos;
- Caja;
- configuración;
- futura experiencia pública;
- inventario/costos;
- integraciones.

Chatwoot u otros canales deben funcionar como interfaces de atención, no como motores paralelos de pedidos.

## Decisión de dominio

La arquitectura objetivo es un solo dominio principal.

Actualmente `alentopizza.com` sigue ocupado por Glide. Durante el desarrollo Alentó App usa infraestructura temporal.

Objetivo cuando se sustituya Glide:

```text
alentopizza.com/        → experiencia pública
alentopizza.com/interno → sistema interno protegido
```

No asumir que POS, Cocina o Caja necesitan dominios separados permanentes.

## Estado de módulos operativos

**POS, Pedidos, Cocina y Clientes están cerrados para la etapa operativa actual.**

Sus referencias canónicas son:

- `docs/POS.md`
- `docs/ORDERS.md`
- `docs/KITCHEN.md`
- `docs/CUSTOMERS.md`

Corregir bugs cuando aparezcan, pero no reabrir decisiones de diseño cerradas sin una solicitud explícita.

## Siguiente bloque acordado

El siguiente módulo a trabajar es **Menú**.

Después de cerrar Menú se revisarán **Integraciones**.

Autenticación y Roles continúa como prioridad estratégica de seguridad, pero no es el siguiente bloque operativo acordado.

## Autenticación — prioridad estratégica actual

Hoy no existe autenticación ni autorización implementada.

Antes de considerar el sistema interno listo para el dominio público principal se debe implementar:

1. `User` y `UserRole` en Prisma;
2. solución de autenticación;
3. hash seguro de contraseñas;
4. login/logout;
5. sesión segura;
6. protección piloto de `/cocina`;
7. protección de todas las páginas internas;
8. protección de todas las APIs internas;
9. permisos por rol;
10. administración de usuarios.

Roles iniciales propuestos:

- `ADMIN`
- `POS`
- `KITCHEN`
- `CASHIER`
- `DISPATCH`

No basta con ocultar botones. La autorización debe existir en servidor.

## Clientes y empleados son entidades distintas

`Customer` representa compradores.

No reutilizar `Customer` como cuenta de empleado. El personal interno debe tener su propio modelo `User`.

## Regla crítica: integridad estructurada

Cada orden debe guardar de forma estructurada qué se vendió.

Pizzas y combos deben conservar IDs reales y snapshots de tamaño, sabores, porciones, bordes, modificadores, grupos, opciones y cantidades.

Esta información es la base futura de Cocina, inventario, recetas y costos.

`POS_SNAPSHOT` es compatibilidad histórica, no arquitectura objetivo.

## Flujo operativo actual

Pedidos nuevos nacen directamente en:

```text
PREPARING
```

Domicilio:

```text
PREPARING → PREPARED → READY → OUT_FOR_DELIVERY → ARRIVED → DELIVERED → COMPLETED
```

Recoger/Local:

```text
PREPARING → PREPARED → READY → COMPLETED
```

Cocina controla preparación hasta `READY`. Pedidos continúa el despacho/cierre.

## Consecutivo comercial

`Order.id` es técnico.

`Order.sequenceNumber` es el consecutivo comercial global compartido por canales.

Ejemplo:

```text
POS-0001
WEB-0002
POS-0003
```

El prefijo depende de `Order.source`; el número no se separa por canal.

No reutilizar números eliminados.

## Pagos y Caja

Medio seleccionado no significa dinero recibido.

Caja solo cuenta `Payment.status = PAID` y `paidAt`.

Eliminar un pago ingresado por error significa borrado físico; deja de contar en Caja.

## Eliminación de pedidos

Eliminar pedido significa borrado físico definitivo.

El backend borra dentro de una transacción:

```text
Payment → OrderItem → Order
```

Cancelar es diferente: conserva trazabilidad con `CANCELED`.

## Prisma en producción

La base de producción no tiene baseline formal de Prisma Migrate.

Cuando cambie el schema usar:

```bash
npx prisma db push
```

No usar `prisma migrate deploy` hasta realizar baseline.

`db push` no ejecuta triggers/functions SQL definidos solamente dentro de migraciones.

## Portabilidad / posibilidad de comercialización

El repositorio debe permanecer comprensible y adaptable para poder replicarse en otros restaurantes.

Separar el núcleo de negocio de:

- marca;
- logos/colores;
- catálogo;
- precios;
- tarifas;
- usuarios;
- dominio;
- secretos;
- infraestructura.

La arquitectura actual es una instalación por negocio. No asumir multi-tenancy todavía.

## Antes de empezar un desarrollo

Confirmar:

1. que `main` contiene el último trabajo;
2. que `CURRENT_STATE.md` describe el comportamiento real;
3. si el cambio requiere Prisma;
4. si afecta integridad estructurada;
5. si afecta pagos/consecutivo/seguridad;
6. qué documento debe actualizarse al cerrar.

## Al cerrar cada bloque

Registrar claramente:

- commit(s) realizados;
- qué cambió;
- si requiere `npx prisma db push`;
- qué debe probarse después del redeploy;
- cuál es el siguiente paso pequeño recomendado.

La documentación del repositorio tiene prioridad como fuente de continuidad frente al historial de chats.
