# Alentó App

Aplicación operativa propia de Alentó Pizza para reemplazar gradualmente Glide y centralizar clientes, catálogo, pedidos, cocina, pagos, configuración e integraciones.

## Objetivo actual

La prioridad es completar la operación después de crear el pedido:

**Tipo de pedido → Cliente → Productos → Cobertura/Domicilio → Descuento → Pago → Crear pedido → Cocina → Entrega/Cierre**

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

La base de datos permanece dentro de la red interna de EasyPanel.

## Tipos de pedido

- `DELIVERY`: Domicilio.
- `PICKUP`: Recoger en tienda.
- `STORE`: Local.

Domicilio y Recoger en tienda requieren cliente. Local permite cliente opcional.

## Estado actual

Ya están implementados:

- catálogo POS;
- clientes;
- pizzas de un sabor y dos sabores;
- tamaños, bordes e ingredientes extra;
- combos configurables y descuento fijo;
- carrito;
- selector de tipo de pedido;
- edición de cliente desde POS;
- configuración persistente de zonas/tarifas de domicilio y medios de pago;
- cierre con tarifa, descuentos, cupones y forma de pago;
- reglas de elegibilidad para excluir combos/promociones de cupones;
- administración de cupones;
- efectivo con `Paga con` y cálculo de vueltas;
- creación real y transaccional de `Order`, `OrderItem` y `Payment`;
- códigos visibles `ALT-XXXXXX`;
- pestaña `/pedidos` con detalle de productos;
- edición controlada de pedidos `CONFIRMED`;
- cambio de modalidad y tarifa de domicilio desde Pedidos;
- ajuste de cantidades y adición de productos simples a una orden confirmada;
- impresión térmica de comprobante a 80 mm.

El siguiente bloque es conectar **Cocina** a pedidos reales y manejar las transiciones de estado operativas.

## Documentación técnica

La documentación forma parte del producto y debe mantenerse junto con el código.

**Si estás retomando este proyecto en un chat nuevo o eres una nueva IA/desarrollador, empieza por [`docs/HANDOFF.md`](docs/HANDOFF.md).**

Después consulta:

- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md): estado funcional actual y próximos pasos.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): arquitectura, responsabilidades, flujos y reglas del sistema.
- [`docs/ORDERS.md`](docs/ORDERS.md): persistencia, edición controlada y comprobante térmico de pedidos.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md): EasyPanel, Prisma, despliegue y resolución de problemas.
- [`docs/HANDOFF.md`](docs/HANDOFF.md): orden de lectura, reglas obligatorias de documentación y procedimiento para retomar el proyecto.

Todo cambio funcional o estructural importante debe actualizar la documentación relacionada antes de considerarse terminado.

## Prisma en producción

La base de producción existía antes de iniciar un historial formal de migraciones. Por ahora se sincronizan cambios de schema manualmente desde la consola del servicio con:

```bash
npx prisma db push
```

o:

```bash
npm run prisma:push
```

No activar `prisma migrate deploy` en el arranque hasta realizar un baseline formal. Ver `docs/DEPLOYMENT.md`.

## Arquitectura objetivo con Chatwoot

Chatwoot será un canal de atención, no un segundo sistema de pedidos.

Los pedidos creados desde POS, WhatsApp/Chatwoot y la futura app de clientes deben terminar usando la misma lógica y los mismos datos de Alentó App.

## Roadmap

1. Cocina conectada a pedidos reales.
2. Transiciones de estado y entrega/cierre.
3. Caja y conciliación de pagos.
4. Mejorar configuración estructurada de pizzas/combos en `OrderItem.configuration`.
5. Edición completa de pizzas/combos reutilizando el constructor del POS.
6. Integración con Chatwoot.
7. Migración gradual desde Glide.
8. App para clientes con experiencia móvil visual.
