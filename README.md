# Alentó App

Aplicación operativa propia de Alentó Pizza para centralizar punto de venta, clientes, catálogo, pedidos, cocina, pagos, caja, configuración y la futura experiencia pública de pedidos.

El proyecto busca reemplazar gradualmente Glide y consolidar en una sola plataforma el sistema interno del restaurante y, más adelante, la app/web pública para clientes.

## Visión de producto

Alentó App debe funcionar desde **un solo dominio principal**.

La arquitectura objetivo es:

```text
alentopizza.com/
├── experiencia pública del cliente
├── menú
├── carrito
├── checkout
└── seguimiento del pedido

alentopizza.com/interno
├── login de empleados
├── POS
├── Pedidos
├── Cocina
├── Clientes
├── Caja
├── Menú administrativo
├── Cupones
└── Configuración
```

Actualmente `alentopizza.com` continúa ocupado por la solución construida en Glide. Alentó App se mantiene en infraestructura temporal mientras se completa y valida. Cuando el sistema esté listo para producción, el dominio principal debe migrarse a Alentó App.

No se busca un dominio diferente para cada módulo. La separación entre experiencia pública e interna se realizará por rutas, autenticación y permisos.

## Fase activa de desarrollo

La prioridad aprobada es:

```text
Cerrar Pedidos
→ Cerrar Cocina
→ Validación integrada Pedidos ↔ Cocina
→ Autenticación y Roles
```

No iniciar Autenticación y Roles antes de aprobar el checkpoint de Pedidos + Cocina.

La hoja de ruta operativa y sus criterios de cierre están en [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Estado actual

Ya están implementados, entre otros:

- POS operativo;
- clientes;
- productos simples;
- pizzas de un sabor y dos sabores;
- tamaños, bordes e ingredientes extra;
- combos configurables;
- carrito estructurado preparado para inventario/costos;
- `OrderItem.configuration` con IDs, cantidades, porciones y snapshots;
- validación y recálculo server-side de pizzas y combos;
- descuentos manuales y cupones;
- medios de pago configurables;
- creación real de pedidos en PostgreSQL;
- Cocina con preparación por cantidades;
- flujo de estados del pedido;
- dashboard de Pedidos;
- edición operativa de órdenes;
- registro y eliminación de pagos;
- Caja basada en dinero realmente recibido;
- impresión térmica de 80 mm;
- eliminación física controlada de pedidos y pagos;
- consecutivo comercial global independiente del `Order.id`;
- códigos visibles como `POS-0001` y, en el futuro, `WEB-0002` compartiendo la misma secuencia.

## Numeración de pedidos

El identificador comercial no depende del `Order.id` técnico.

Cada pedido nuevo recibe `Order.sequenceNumber` desde un contador global compartido entre todos los canales.

Ejemplo:

```text
POS-0001
POS-0002
WEB-0003
POS-0004
```

Ver `docs/ORDER_NUMBERING.md`.

## Próximo bloque estratégico: autenticación y roles

El sistema interno todavía **no tiene login ni protección por roles**.

Este bloque comenzará solamente después de cerrar Pedidos y Cocina según `docs/ROADMAP.md`.

Antes de exponer Alentó App como reemplazo definitivo de Glide se debe implementar:

- modelo de usuarios internos;
- roles y permisos;
- contraseñas con hash seguro;
- sesiones;
- protección de páginas internas;
- protección de APIs internas;
- administración de usuarios;
- separación clara entre empleados y clientes.

Roles iniciales propuestos:

- `ADMIN`;
- `POS`;
- `KITCHEN`;
- `CASHIER`;
- `DISPATCH`.

La guía completa está en [`docs/AUTH_ROLES_AND_PUBLIC_APP.md`](docs/AUTH_ROLES_AND_PUBLIC_APP.md).

## App pública futura

La futura experiencia tipo app de delivery para clientes reutilizará el mismo motor de negocio del sistema interno.

No debe existir un segundo sistema de pedidos.

La app pública compartirá:

- catálogo;
- configuradores de producto;
- precios;
- promociones;
- cobertura/domicilio;
- clientes;
- pedidos;
- pagos;
- configuración estructurada de `OrderItem`;
- consecutivo comercial global.

Las órdenes originadas por esa experiencia usarán `Order.source = WEB`.

## Arquitectura técnica

- Next.js 15 + TypeScript.
- React 19.
- Tailwind CSS 4.
- PostgreSQL.
- Prisma 6.
- EasyPanel sobre VPS.
- Repositorio GitHub privado.

## Infraestructura actual

- Proyecto EasyPanel: `app_alento`.
- Servicio web: `alento-app`.
- PostgreSQL: `alento-db`.
- Acceso temporal actual del POS: `https://pos.alentopizza.com/`.
- Dominio comercial principal actual: `alentopizza.com`, todavía servido por Glide.

Los dominios/subdominios actuales deben entenderse como una etapa de transición. La arquitectura objetivo es un solo dominio principal.

## Tipos de pedido

- `DELIVERY`: Domicilio.
- `PICKUP`: Recoger en tienda.
- `STORE`: Local.

Domicilio y Recoger requieren cliente. Local permite cliente opcional.

## Integridad de producto

La configuración estructurada de los productos vendidos es una regla central del sistema.

Las órdenes nuevas de pizza/combo deben conservar IDs reales de tamaños, sabores, porciones, bordes, modificadores y componentes de combos. Esa información será la base de inventario, recetas, costos y rentabilidad.

Nunca reemplazar esta estructura por texto plano del ticket.

Ver [`docs/ORDER_DATA_INTEGRITY.md`](docs/ORDER_DATA_INTEGRITY.md).

## Pagos y Caja

Seleccionar un medio de pago al tomar la orden no significa que el dinero haya sido recibido.

Caja contabiliza únicamente pagos registrados realmente como recibidos (`PAID`). Los pagos creados por error pueden eliminarse físicamente y dejan de formar parte de Caja.

Ver [`docs/PAYMENTS_AND_CASH.md`](docs/PAYMENTS_AND_CASH.md).

## Documentación técnica

La documentación forma parte del producto y debe mantenerse junto con el código.

Si estás retomando el proyecto en otro chat/equipo, empieza por [`docs/HANDOFF.md`](docs/HANDOFF.md).

Documentos principales:

- [`docs/ROADMAP.md`](docs/ROADMAP.md): orden de implementación por fases y criterios de cierre.
- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md): estado funcional actual.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): arquitectura y responsabilidades.
- [`docs/AUTH_ROLES_AND_PUBLIC_APP.md`](docs/AUTH_ROLES_AND_PUBLIC_APP.md): autenticación, permisos, dominio único y app pública.
- [`docs/ORDER_DATA_INTEGRITY.md`](docs/ORDER_DATA_INTEGRITY.md): integridad estructurada para inventario/costos.
- [`docs/ORDER_NUMBERING.md`](docs/ORDER_NUMBERING.md): consecutivo comercial global.
- [`docs/ORDERS.md`](docs/ORDERS.md): comportamiento operativo de pedidos.
- [`docs/PAYMENTS_AND_CASH.md`](docs/PAYMENTS_AND_CASH.md): pagos reales y Caja.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md): EasyPanel y Prisma.
- [`docs/HANDOFF.md`](docs/HANDOFF.md): continuidad del proyecto.

## Prisma en producción

La base de producción existía antes de un historial formal de migraciones.

Cuando un cambio modifique el schema se usa manualmente:

```bash
npx prisma db push
```

No usar `prisma migrate deploy` hasta realizar un baseline formal.

`prisma db push` no ejecuta SQL personalizado contenido únicamente en archivos de migración. La lógica operativa crítica debe vivir preferiblemente en la aplicación o documentarse con un procedimiento SQL explícito si fuera imprescindible.

## Portabilidad / producto replicable

El repositorio debe mantenerse entendible y adaptable para que pueda instalarse en otro restaurante o evolucionar a un producto comercial.

Las reglas generales deben separarse de:

- nombre y marca;
- logotipos/colores;
- catálogo;
- tarifas;
- medios de pago;
- usuarios;
- dominio;
- secretos e infraestructura de cada instalación.

Actualmente la arquitectura corresponde a una instalación por negocio. No asumir multi-tenancy hasta que exista una decisión explícita y un diseño para ello.

## Roadmap recomendado

1. Cerrar Pedidos según `docs/ROADMAP.md`.
2. Cerrar Cocina según `docs/ROADMAP.md`.
3. Aprobar checkpoint integrado POS → Pedidos → Cocina → Pago → Caja.
4. Implementar usuarios internos, login y sesiones.
5. Proteger páginas y APIs internas.
6. Aplicar permisos por rol.
7. Administración de usuarios y auditoría básica.
8. Terminar Caja/conciliación y cierres operativos.
9. Inventario, recetas y costos usando los IDs estructurados guardados en pedidos.
10. Integraciones de atención como Chatwoot.
11. Construir experiencia pública de pedidos reutilizando el mismo motor comercial.
12. Sustituir Glide y migrar `alentopizza.com` a Alentó App.
13. Evaluar empaquetado/parametrización para replicar la solución en otros negocios.
