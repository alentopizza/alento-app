# Handoff y continuidad del proyecto

Este documento permite que una nueva persona, desarrollador o IA retome Alentó App sin depender del historial de conversaciones.

## Lectura obligatoria

Leer en este orden:

1. `README.md`
2. `docs/CURRENT_STATE.md`
3. `docs/ROADMAP.md`
4. `docs/POS.md`
5. `docs/ORDERS.md`
6. `docs/KITCHEN.md`
7. `docs/CUSTOMERS.md`
8. `docs/MENU.md`
9. `docs/ARCHITECTURE.md`
10. `docs/ORDER_DATA_INTEGRITY.md`
11. `docs/ORDER_NUMBERING.md`
12. `docs/PAYMENTS.md`
13. `docs/PAYMENTS_AND_CASH.md`
14. `docs/AUTH_ROLES_AND_PUBLIC_APP.md`
15. `docs/DEPLOYMENT.md`
16. `prisma/schema.prisma`
17. archivos del módulo que se vaya a modificar.

Después revisar commits recientes de `main`.

## Fuente de verdad

Orden de prioridad:

```text
1. comportamiento actual del código
2. prisma/schema.prisma
3. documento canónico del módulo
4. CURRENT_STATE / ROADMAP
5. historial de commits
6. historial de chats
```

Si documentación y código discrepan, verificar el comportamiento real y actualizar la documentación en el mismo bloque.

## Módulos cerrados

Están cerrados para la etapa operativa actual:

- Punto de venta;
- Pedidos;
- Cocina;
- Clientes;
- Menú.

Documentos canónicos:

- `docs/POS.md`
- `docs/ORDERS.md`
- `docs/KITCHEN.md`
- `docs/CUSTOMERS.md`
- `docs/MENU.md`

"Cerrado" no significa congelado para siempre. Significa que:

- el flujo aprobado ya existe;
- no se debe rediseñar por iniciativa propia;
- bugs sí se corrigen;
- pequeñas mejoras visuales sí pueden hacerse;
- cambios estructurales requieren solicitud explícita;
- toda modificación debe respetar reglas de no regresión.

## Mapa para reconstrucción

### Punto de venta

Ruta: `/interno`

La raíz `/` corresponde a la experiencia pública del cliente.

Entrada principal:

- `src/components/StructuredPosPageV2.tsx`

Dependencias críticas:

- `GET /api/catalog`
- `POST /api/orders`
- `src/lib/orderLineNormalizer.ts`
- `src/lib/orderConfiguration.ts`
- `src/lib/orderCode.ts`

Responsabilidad: construir una orden válida y estructurada.

### Pedidos

Ruta: `/pedidos`

Archivos principales:

- `src/app/pedidos/page.tsx`
- `src/components/OrdersCardsDashboardV3.tsx`
- `src/components/OrderEditStructuredAdder.tsx`
- `src/components/ActionConfirmModal.tsx`

Responsabilidad: administrar una orden ya creada, pagos, cliente, impresión, cancelación, eliminación y estados posteriores a Cocina.

### Cocina

Ruta: `/cocina`

Archivos principales:

- `src/app/cocina/page.tsx`
- endpoints de prepared/status en `src/app/api/orders/[id]/...`
- `src/lib/orderPresentation.ts`
- `src/lib/orderWorkflow.ts`

Responsabilidad: preparación, no finanzas.

### Clientes

Ruta: `/clientes`

Archivos principales:

- `src/app/clientes/page.tsx`
- `src/app/api/customers/**`
- `src/lib/customerCsv.ts`

Responsabilidad: CRM operativo, historial y administración de datos.

### Menú

Ruta: `/menu`

Archivos principales:

- `src/app/menu/page.tsx`
- `src/app/api/menu-admin/route.ts`
- `src/app/api/catalog/route.ts`

Responsabilidad: administrar el catálogo que consume POS.

Regla crítica:

```text
Category.name = nombre visible
Category.slug = identificador interno estable
Product.categoryId = relación real
Product.type = comportamiento estructural
```

No confundir estos conceptos.

## Dependencias entre módulos

```text
Menú
  ↓
/api/catalog
  ↓
POS
  ↓
Order + OrderItem.configuration
  ↓
Pedidos
  ↓
Cocina
  ↓
Estados posteriores / Caja
```

Clientes se relaciona con Order mediante `customerId`, pero no debe ser utilizado como usuario interno.

## Integridad estructurada

Cada orden debe guardar de forma estructurada qué se vendió.

No reemplazar configuración por texto de ticket.

Pizzas y combos deben conservar IDs reales y snapshots de tamaño, sabores, porciones, bordes, modificadores, grupos, opciones y cantidades.

Esta estructura alimenta:

- Cocina;
- impresión;
- edición;
- inventario futuro;
- recetas;
- costos;
- rentabilidad.

## Menú: reglas que una IA no debe inferir

- renombrar categoría no cambia slug;
- categorías base pueden moverse/renombrarse pero no eliminarse;
- categoría personalizada solo se elimina vacía;
- el orden de categorías viene de `Category.sortOrder`;
- el orden normal de productos viene de `Product.sortOrder`;
- Destacados usa `Product.featured` y orden propio en `AppSetting`;
- una categoría personalizada crea actualmente productos `STANDARD`;
- `ProductType` todavía es enum fijo;
- modificadores avanzados son backlog, no comportamiento implementado;
- extras están deshabilitados para pizzas de dos sabores hasta definir alcance por mitad.

## Pagos y Caja

Medio previsto no significa ingreso.

- `PENDING`: intención.
- `PAID`: dinero recibido.

Caja solo debe contar `PAID`.

## Consecutivo

`Order.id` es técnico.

Usar `Order.sequenceNumber` + `Order.source`.

No reutilizar números eliminados.

## Estados

Domicilio:

```text
PREPARING → PREPARED → READY → OUT_FOR_DELIVERY → ARRIVED → DELIVERED → COMPLETED
```

Recoger/Local:

```text
PREPARING → PREPARED → READY → COMPLETED
```

Cocina controla preparación hasta `READY`; Pedidos continúa después.

## Eliminaciones

### Pedido

```text
Activo → Cancelar → Eliminar
```

### Producto

No eliminar si tiene historial o dependencias de combo.

### Categoría

No eliminar categoría base.

No eliminar categoría personalizada con productos.

### Cliente

La semántica está documentada en `CUSTOMERS.md`; no extrapolar reglas de otros modelos.

## Autenticación

La primera versión ya existe.

Colaboradores:

- `User` separado de `Customer`;
- correo + contraseña;
- roles múltiples;
- cookie `alento_staff_session`;
- `/login`;
- `/usuarios`;
- middleware para páginas y APIs internas principales.

Clientes:

- navegación pública futura sin login obligatorio;
- teléfono + OTP de WhatsApp;
- `CustomerAccount`;
- cookie `alento_customer_session`;
- `/cuenta/login`;
- `/cuenta`.

Variables y activación están documentadas en `docs/AUTH_ROLES_AND_PUBLIC_APP.md` y `docs/DEPLOYMENT.md`.

No confundir autorización visual con autorización server-side.

## Integraciones

Integraciones externas son la última fase.

No reintroducir Rappi/DiDi experimentalmente sin acceso oficial y diseño aprobado.

## Activación pendiente después del cambio de autenticación

Antes de probar login en un despliegue existente:

1. configurar `AUTH_SESSION_SECRET`;
2. configurar `AUTH_BOOTSTRAP_KEY`;
3. ejecutar `npx prisma db push`;
4. crear el primer ADMIN desde `/setup/admin`;
5. crear colaboradores desde `/usuarios`;
6. configurar WhatsApp cuando se vaya a probar login de clientes.

## Prisma en producción

No existe baseline formal de Prisma Migrate.

Cuando cambie schema:

```bash
npx prisma db push
```

No usar `prisma migrate deploy` hasta realizar baseline.

## Regla obligatoria de documentación

Todo cambio funcional relevante debe actualizar:

- documento canónico del módulo;
- `CURRENT_STATE.md` si cambia estado/comportamiento;
- `ROADMAP.md` si cambia fase;
- `README.md` si cambia arquitectura/objetivo global;
- `DEPLOYMENT.md` si cambia infraestructura/Prisma.

## Al cerrar un bloque

Registrar:

- commit;
- comportamiento añadido/cambiado;
- archivos principales;
- endpoints;
- datos/modelos involucrados;
- reglas de no regresión;
- necesidad o no de `npx prisma db push`;
- prueba mínima después de redeploy.

La documentación del repositorio tiene prioridad sobre el historial de chats.
