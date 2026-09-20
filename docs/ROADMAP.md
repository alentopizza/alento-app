# Roadmap de implementación

## Estado de fases

```text
Punto de venta        ✅ CERRADO
Pedidos               ✅ CERRADO
Cocina                ✅ CERRADO
Clientes              ✅ CERRADO
Menú                  ✅ CERRADO
Autenticación/Roles   🟡 V1 IMPLEMENTADA
Caja avanzada         ⏳ PENDIENTE
Inventario/Costos     ⏳ FUTURO
Experiencia pública   ⏳ FUTURO
Integraciones         ⏳ ÚLTIMA FASE DEL DESARROLLO
```

Los módulos cerrados pueden recibir correcciones de bugs y pequeños ajustes de UX, pero no deben reabrirse como fase de diseño sin una solicitud explícita.

---

# Fase completada — Punto de venta

Estado: **CERRADO PARA LA ETAPA OPERATIVA ACTUAL**

Referencia: `docs/POS.md`.

Incluye modalidades, clientes, catálogo, búsqueda, pizzas, dos sabores, tamaños, bordes, extras donde aplican, combos, carrito, notas, checkout, intención de pago, creación real del pedido, consecutivo global y recálculo server-side.

---

# Fase completada — Pedidos

Estado: **CERRADO PARA LA ETAPA OPERATIVA ACTUAL**

Referencia: `docs/ORDERS.md`.

Incluye tarjetas, búsqueda/filtros, drawer, edición estructurada, cliente, notas, pagos, saldo, impresión, cancelación, eliminación y estados posteriores a Cocina.

---

# Fase completada — Cocina

Estado: **CERRADO PARA LA ETAPA OPERATIVA ACTUAL**

Referencia: `docs/KITCHEN.md`.

Incluye cola real, prioridad de preparación, bebidas excluidas, preparación por cantidades, auto `PREPARED`, acción `READY`, cronómetro, cliente, configuración legible y notas.

---

# Fase completada — Clientes

Estado: **CERRADO PARA LA ETAPA OPERATIVA ACTUAL**

Referencia: `docs/CUSTOMERS.md`.

Incluye búsqueda, clasificación comercial, métricas, perfil, historial, impresión, importación/exportación CSV, edición, eliminación individual y eliminación masiva configurable.

---

# Fase completada — Menú

Estado: **CERRADO PARA LA ETAPA OPERATIVA ACTUAL**

Referencia: `docs/MENU.md`.

Incluye:

- categorías administrables;
- drag & drop de categorías;
- nombres editables sin cambiar slugs;
- categorías personalizadas;
- eliminación segura;
- productos;
- búsqueda;
- tarjetas visuales;
- drag & drop de productos;
- Destacados con orden independiente;
- Activo / Visible en POS / Destacado;
- edición visual;
- eliminación protegida;
- combos configurables;
- sincronización con POS.

## Backlog futuro de Menú

No forma parte del cierre actual:

1. **Tipos de producto**
   - convertir comportamiento rígido del enum actual en una capa más configurable;
   - definir capacidades por tipo: Cocina, tamaño, borde, sabores, modificadores, precio, combos.

2. **Modificadores**
   - grupos de modificadores;
   - mínimos/máximos;
   - disponibilidad por producto/categoría/tamaño;
   - reglas e incompatibilidades;
   - modificadores por mitad para pizzas de dos sabores.

No implementar estas mejoras como parche. Requieren diseño estructural porque afectan POS, Cocina, normalización de pedidos e inventario futuro.

---

# Autenticación y Roles

Estado: **PRIMERA VERSIÓN IMPLEMENTADA**

Documento: `docs/AUTH_ROLES_AND_PUBLIC_APP.md`.

Ya existe login interno, roles, sesiones firmadas, navegación por rol, protección inicial de páginas/APIs y administración de usuarios. Antes de la exposición definitiva todavía conviene completar recuperación de contraseña, auditoría y revocación inmediata de sesiones.

Roles iniciales propuestos:

- `ADMIN`;
- `POS`;
- `KITCHEN`;
- `CASHIER`;
- `DISPATCH`.

`Customer` y el futuro `User` deben permanecer como entidades distintas.

---

# Fases posteriores conocidas

- Caja avanzada / conciliación / cierres;
- devoluciones y reembolsos;
- auditoría;
- inventario;
- recetas;
- costos;
- rentabilidad;
- experiencia pública;
- sustitución de Glide;
- migración de `alentopizza.com`;
- parametrización para replicar/comercializar;
- integraciones externas al final.

---

# Integraciones

Estado: **ÚLTIMA FASE DEL DESARROLLO**

No existe integración activa con Rappi/DiDi en el código actual.

No reintroducir la implementación experimental sin:

- credenciales/API oficial;
- flujo aprobado por proveedor;
- estrategia de catálogo;
- estrategia de estados;
- conciliación financiera;
- pruebas aisladas.

---

# Regla de trabajo

Antes de modificar un módulo cerrado:

1. leer `docs/CURRENT_STATE.md`;
2. leer el documento canónico del módulo;
3. revisar `prisma/schema.prisma`;
4. revisar los endpoints y componentes indicados;
5. identificar reglas de no regresión;
6. hacer el cambio más pequeño posible;
7. validar build;
8. actualizar documentación;
9. indicar si requiere `npx prisma db push`.

La documentación del repositorio debe tener prioridad sobre el historial de chats.
