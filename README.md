# Alentó App

Aplicación operativa propia de Alentó Pizza para reemplazar gradualmente Glide y centralizar clientes, catálogo, pedidos, cocina, pagos, configuración e integraciones.

## Objetivo actual

La prioridad es terminar el flujo completo del punto de venta (POS):

**Tipo de pedido → Cliente → Productos → Cobertura/Domicilio → Pago → Revisión → Pedido → Cocina**

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
- configuración persistente de cobertura, tarifas de domicilio y medios de pago;
- API de cotización por distancia conocida.

El siguiente bloque es el cierre del pedido con domicilio/cobertura, pago, revisión y persistencia real del `Order`.

## Documentación técnica

La documentación es parte del proyecto y debe actualizarse cuando cambie una decisión estructural.

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): arquitectura, responsabilidades, flujos y reglas del sistema.
- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md): estado funcional actual y próximos pasos.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md): EasyPanel, Prisma, despliegue y resolución de problemas.

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

1. Finalizar cierre del pedido POS.
2. Persistencia y gestión de pedidos.
3. Cocina conectada a pedidos reales.
4. Caja y conciliación de pagos.
5. Integración con Chatwoot.
6. Migración gradual desde Glide.
7. App para clientes con experiencia móvil visual.
