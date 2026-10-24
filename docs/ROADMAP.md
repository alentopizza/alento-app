# Roadmap de implementación

## Estado de fases

```text
Punto de venta        ✅ CERRADO
Pedidos               ✅ CERRADO
Cocina                ✅ CERRADO
Clientes              ✅ CERRADO
Menú                  ✅ CERRADO
Autenticación/Roles   🟡 V1 IMPLEMENTADA
Caja básica           ✅ IMPLEMENTADA / CIERRE AVANZADO PENDIENTE
Inventario/Costos     ⏳ FUTURO
Experiencia pública   ✅ CHECKOUT + SEGUIMIENTO IMPLEMENTADOS / VALIDACIÓN PRODUCTIVA
Reparto               ✅ FLUJO OPERATIVO + GPS + MAPAS IMPLEMENTADOS
Producción             🟡 HARDENING Y VALIDACIÓN
Métricas/medición      ✅ V1 IMPLEMENTADA
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
9. indicar si requiere `npx prisma db push`.

La documentación del repositorio debe tener prioridad sobre el historial de chats.


---

# Experiencia pública — V1

Estado: **CHECKOUT WEB Y SEGUIMIENTO IMPLEMENTADOS / VALIDACIÓN PRODUCTIVA PENDIENTE**.

### Implementado

- `/` Home pública aprobada;
- `/menu` catálogo público oficial;
- `/cart` carrito persistente;
- configurador público para productos simples, pizzas, dos sabores y combos;
- navegación persistente Menú / Carrito / Club / Perfil;
- `/club` con reglas públicas y saldo/movimientos con sesión;
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
- formas de pago públicas desde configuración;
- efectivo con "Paga con" y cálculo de vueltas;
- creación de pedido `Order.source=WEB`;
- recálculo server-side de productos y domicilio;
- creación/vinculación de `Customer` por teléfono;
- pago inicial `PENDING`;
- código comercial `WEB-xxxx`;
- enlace firmado de seguimiento;
- notificación de pedido creado cuando el notifier está configurado.

### Pendiente para cerrar la validación productiva

1. Ejecutar el checklist end-to-end de `docs/PRODUCTION_READINESS.md`.
2. Validar producción en móvil, PWA, tablet y escritorio.
3. Decidir el alcance de lanzamiento del canje de Club Alentó.
4. Endurecer despliegue/Prisma y automatizar build/lint.
5. Implementar refund antes de permitir cancelaciones posteriores a pagos recibidos.

Referencia canónica: `docs/PUBLIC_CHECKOUT_MAPS.md`.

No implementar un segundo motor comercial para la web.
