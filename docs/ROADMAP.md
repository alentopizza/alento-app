# Roadmap de implementación

## Estado de fases

```text
Punto de venta        ✅ CERRADO
Pedidos               ✅ CERRADO
Cocina                ✅ CERRADO
Clientes              ✅ CERRADO
Menú                  ✅ CERRADO
Autenticación/Roles   🟡 V1 IMPLEMENTADA
Caja / Nómina         ✅ OPERATIVA / REFUND IMPLEMENTADO, VALIDACIÓN FINAL EN CURSO
Inventario/Costos     ⏳ FUTURO
Experiencia pública   ✅ EN PRODUCCIÓN / MEJORA CONTINUA
Reparto               ✅ FLUJO OPERATIVO + GPS + MAPAS IMPLEMENTADOS
Producción             ✅ ACTIVA / HARDENING CONTINUO
Métricas/medición      ✅ V1 IMPLEMENTADA
Auditoría               ✅ AUDIT LOG VALIDADO EN PRODUCCIÓN
Observabilidad          ✅ VALIDADA EN PRODUCCIÓN
Integraciones marketplace 🔒 OPCIONALES / FUTURAS
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

Ya existe login interno, roles, sesiones firmadas, navegación por rol, protección de páginas/APIs y administración de usuarios. La revocación inmediata de sesiones, rate limiting y Audit Log ya están implementados. La recuperación de contraseña sigue como evolución futura.

Roles iniciales propuestos:

- `ADMIN`;
- `POS`;
- `KITCHEN`;
- `CASHIER`;
- `DRIVER`.

`DISPATCH` se conserva solo como compatibilidad legacy en Prisma.

`Customer` y el futuro `User` deben permanecer como entidades distintas.

---

# Fases posteriores conocidas

- cerrar validación productiva de devoluciones/reembolsos auditables;
- inventario;
- recetas;
- costos;
- rentabilidad;
- canje transaccional de Club Alentó;
- parametrización para replicar/comercializar;

---

# Métricas e integraciones

Estado de medición: **V1 IMPLEMENTADA**

Documento: `docs/METRICS_AND_TRACKING.md`.

Ya existe analítica interna del catálogo y configuración guiada para Meta Pixel, GA4, TikTok Pixel, Microsoft Clarity, Google Tag Manager y Google Ads. La analítica interna es independiente de los rastreadores externos.

Estado de marketplace/proveedores: **FUTURO / OPCIONAL**

No existe integración activa con marketplaces externos en el código actual.

No reintroducir una integración de marketplace sin:

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
9. revisar `docs/DEPLOYMENT.md` si hay cambios de schema; todo cambio nuevo debe incluir migración versionada porque el arranque vigente ejecuta `prisma migrate deploy`.

La documentación del repositorio debe tener prioridad sobre el historial de chats.


---

# Experiencia pública — V1

Estado: **CHECKOUT WEB Y SEGUIMIENTO IMPLEMENTADOS Y EN PRODUCCIÓN / VALIDACIÓN CONTINUA**.

### Implementado

- `/` Home pública aprobada;
- `/menu` catálogo público oficial;
- `/cart` carrito persistente;
- configurador público para productos simples, pizzas, dos sabores y combos;
- navegación persistente Menú / Carrito / Club / Perfil con feedback inmediato, prefetch y estados de carga;
- `/cart` difiere la carga de mapa/datos de checkout hasta que el usuario continúa;
- `/club` con reglas públicas y saldo/movimientos con sesión cuando Club está activo;
- Club puede apagarse desde administración, ocultándose de la app y pausando nuevas acreditaciones sin borrar saldos;
- `/login` unificado;
- Google Places y GPS opcional;
- origen oficial de Alentó en `pos_settings`;
- Google Routes calcula distancia, duración y geometría server-side;
- cobertura y tarifa server-side;
- checkout por defecto en Recoger en tienda;
- precarga de dirección guardada solo para cliente autenticado y sin bloquear;
- mapa 3:4 con cabecera integrada Ruta / Domicilio / Tiempo;
- asignación de repartidor y seguimiento tokenizado para pedidos internos.

### Implementado en cierre de compra

- paso de datos del cliente después de Recoger/Domicilio;
- compra como invitado sin login obligatorio;
- autocompletado inmediato cuando existe sesión de cliente;
- recuperación segura de datos mediante OTP de WhatsApp;
- cupones públicos opcionales con visibilidad por canal, selección en Entrega/Totales y recálculo server-side;
- promociones/no elegibles quedan fuera de la base de cupón;
- formas de pago públicas desde configuración;
- efectivo con "Paga con" y cálculo de vueltas;
- creación de pedido `Order.source=WEB`;
- recálculo server-side de productos y domicilio;
- creación/vinculación de `Customer` por teléfono;
- pago inicial `PENDING`;
- código comercial `WEB-xxxx`;
- enlace firmado de seguimiento;
- notificación de pedido creado cuando el notifier está configurado.

### Pendientes de evolución y hardening

1. Mantener pruebas end-to-end periódicas en móvil, PWA, tablet y escritorio.
2. Completar el canje transaccional de Club Alentó.
3. Mantener CI, migraciones versionadas, backups, auditoría y observabilidad alineados con cada cambio crítico.
4. Mantener validado el flujo de refund: devolución auditable antes de cancelar pedidos con dinero neto recibido.
5. Mantener `docs/FEATURE_INVENTORY.md` alineado con nuevas rutas y capacidades.

Referencias canónicas: `docs/PUBLIC_CHECKOUT_MAPS.md`, `docs/COUPONS.md` y `docs/CLUB_POINTS.md`.

No implementar un segundo motor comercial para la web.
