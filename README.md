# Alentó App

Aplicación operativa propia de Alentó Pizza para reemplazar gradualmente Glide y centralizar clientes, catálogo, pedidos, cocina, pagos, configuración e integraciones.

## Objetivo actual

La prioridad inmediata es validar que **cada pedido nuevo guarde la configuración estructurada completa del producto**, porque esa información será la base futura de inventario, recetas y costos.

Flujo actual:

**Tipo de pedido → Cliente → Productos estructurados → Cobertura/Domicilio → Descuento → Pago → Crear pedido → Validar integridad → Cocina → Entrega/Cierre**

## Arquitectura

- Next.js 15 + TypeScript.
- React 19.
- PostgreSQL.
- Prisma 6.
- EasyPanel sobre VPS.
- Repositorio GitHub privado.

## Infraestructura

- Proyecto EasyPanel: `app_alento`.
- Servicio web: `alento-app`.
- PostgreSQL: `alento-db`.
- POS: `https://pos.alentopizza.com/`.

## Tipos de pedido

- `DELIVERY`: Domicilio.
- `PICKUP`: Recoger en tienda.
- `STORE`: Local.

Domicilio y Recoger requieren cliente. Local permite cliente opcional.

## Estado actual

Ya están implementados:

- catálogo POS;
- clientes;
- pizzas de un sabor y dos sabores;
- tamaños, bordes e ingredientes extra;
- combos configurables;
- carrito estructurado preparado para inventario;
- `OrderItem.configuration` con IDs, cantidades, porciones y snapshots;
- validación/recalculo server-side de pizzas y combos;
- cupones y descuento manual;
- medios de pago y efectivo con vueltas;
- creación transaccional de `Order`, `OrderItem` y `Payment`;
- `/pedidos` con detalle estructurado;
- edición controlada de pedidos `CONFIRMED`;
- cancelación de pedidos;
- eliminación definitiva solo después de cancelar;
- impresión térmica de 80 mm.

### Integridad de producto

Las órdenes nuevas de pizza/combo ya no deben depender de texto `POS_SNAPSHOT`.

Una pizza conserva tamaño, sabores, porciones, borde y modificadores por ID. Un combo conserva pizzas, grupos, opciones y cantidades por ID.

El servidor vuelve a validar esas selecciones y recalcula el precio desde PostgreSQL antes de crear la orden.

El objetivo es que inventario y costos puedan consumir la orden directamente, sin interpretar texto.

## Próxima prueba obligatoria

Antes de avanzar a Cocina:

1. limpiar los pedidos de prueba antiguos desde `/pedidos` usando Cancelar → Eliminar definitivamente;
2. crear una pizza de un sabor;
3. crear una pizza de dos sabores;
4. crear una pizza con borde y extra;
5. crear un combo con pizza + antojo + bebida;
6. crear un producto simple;
7. verificar en Pedidos e impresión que la configuración se conserva correctamente.

Si una orden nueva de pizza/combo aparece únicamente como texto histórico, no avanzar a Cocina.

## Documentación técnica

La documentación forma parte del producto y debe mantenerse junto con el código.

**Si estás retomando el proyecto en otro chat, empieza por [`docs/HANDOFF.md`](docs/HANDOFF.md).**

Después consulta:

- [`docs/ORDER_DATA_INTEGRITY.md`](docs/ORDER_DATA_INTEGRITY.md): requisito crítico para inventario/costos.
- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md): estado funcional actual y siguiente prueba.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): arquitectura y responsabilidades.
- [`docs/ORDERS.md`](docs/ORDERS.md): persistencia, edición, cancelación, eliminación e impresión.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md): EasyPanel y Prisma.
- [`docs/HANDOFF.md`](docs/HANDOFF.md): continuidad entre chats/equipos.

## Prisma en producción

La base de producción existía antes de un historial formal de migraciones. Cuando un cambio modifique el schema se usa manualmente:

```bash
npx prisma db push
```

No usar `prisma migrate deploy` hasta realizar un baseline formal.

**El refactor actual de integridad estructurada usa el JSON `OrderItem.configuration` existente y no agrega columnas nuevas, así que no requiere otro `db push` si el schema anterior ya está sincronizado.**

## Arquitectura objetivo con Chatwoot

Chatwoot será un canal de atención, no un segundo sistema de pedidos.

POS, Chatwoot y la futura app de clientes deben terminar enviando la misma configuración estructurada de producto al mismo motor de órdenes.

## Roadmap

1. Validar órdenes estructuradas en producción.
2. Cocina conectada a pedidos reales.
3. Transiciones de estado y entrega/cierre.
4. Edición completa de pizzas/combos reutilizando el constructor estructurado.
5. Inventario, recetas y costos usando los IDs guardados en pedidos.
6. Caja y conciliación.
7. Integración con Chatwoot.
8. Migración gradual desde Glide.
9. App para clientes.