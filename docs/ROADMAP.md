# Roadmap de implementación

## Estado de fases

```text
Punto de venta        ✅ CERRADO
Pedidos               ✅ CERRADO
Cocina                ✅ CERRADO
Clientes              ✅ CERRADO POR AHORA
Menú                  ▶ SIGUIENTE FASE
Integraciones         ⏳ DESPUÉS DE MENÚ
```

Los módulos cerrados siguen sujetos a corrección de bugs, pero no deben reabrirse como fase de diseño salvo decisión explícita.

---

# Fase completada — Punto de venta

Estado: **CERRADO**

Referencia canónica: `docs/POS.md`.

Incluye:

- modalidades;
- clientes;
- catálogo;
- pizzas;
- dos sabores;
- bordes;
- extras;
- combos;
- carrito;
- notas por pizza;
- checkout;
- pagos previstos;
- creación real del pedido;
- consecutivo global;
- recalculo server-side.

---

# Fase completada — Pedidos

Estado: **CERRADO**

Referencia canónica: `docs/ORDERS.md`.

Incluye:

- tarjetas operativas;
- búsqueda/filtros;
- drawer;
- edición;
- cambio de cliente;
- configuración estructurada;
- notas;
- pagos;
- saldo;
- impresión;
- cancelación;
- eliminación;
- estados posteriores a Cocina.

---

# Fase completada — Cocina

Estado: **CERRADO**

Referencia canónica: `docs/KITCHEN.md`.

Incluye:

- cola real;
- 3 pedidos por fila;
- prioridad pizzas → antojos;
- bebidas excluidas;
- preparación por cantidades;
- auto `PREPARED`;
- acción `READY`;
- cronómetro;
- cliente;
- chips de tamaño/borde/sabores/extras;
- notas visibles;
- UI optimizada para lectura a distancia.

---
 
# Fase completada — Clientes

Estado: **CERRADO POR AHORA**

Referencia canónica: `docs/CUSTOMERS.md`.

Incluye:

- búsqueda y filtros;
- estados comerciales;
- métricas de compra;
- perfil detallado;
- historial estructurado;
- impresión de copias;
- importación/exportación CSV;
- edición/eliminación;
- eliminación masiva configurable.

---

# Fase siguiente — Menú

Estado: **SIGUIENTE FASE DE TRABAJO**

Objetivo: revisar y cerrar el módulo administrativo de catálogo/menú antes de abordar integraciones externas.

---

# Fase activa — Autenticación y Roles

Estado: **SIGUIENTE FASE APROBADA**

Documento de diseño:

`docs/AUTH_ROLES_AND_PUBLIC_APP.md`

Orden recomendado:

1. agregar `User` y `UserRole` a Prisma;
2. definir solución de autenticación;
3. hash seguro de contraseñas;
4. login;
5. logout;
6. sesión segura;
7. proteger una ruta piloto;
8. proteger todas las páginas internas;
9. proteger APIs internas;
10. autorización por rol en servidor;
11. adaptar navegación;
12. administración de usuarios;
13. desactivación de usuarios;
14. documentar despliegue y variables;
15. probar accesos permitidos/denegados.

Roles iniciales:

- `ADMIN`
- `POS`
- `KITCHEN`
- `CASHIER`
- `DISPATCH`

`Customer` y `User` deben seguir siendo entidades distintas.

---

# Fases posteriores

Después de autenticación:

- cierre de Caja y conciliación;
- devoluciones/reembolsos;
- auditoría;
- inventario;
- recetas;
- costos;
- rentabilidad;
- integraciones como Chatwoot;
- experiencia pública;
- sustitución de Glide;
- migración de `alentopizza.com`;
- parametrización para replicar/comercializar.

---

# Dominio objetivo

```text
alentopizza.com/        → experiencia pública
alentopizza.com/interno → sistema interno protegido
```

Durante construcción puede seguir utilizándose infraestructura temporal.

---

# Regla de trabajo

Antes de un cambio:

1. leer `CURRENT_STATE.md`;
2. leer el documento canónico del módulo;
3. identificar fase activa;
4. mantener cambios pequeños;
5. validar no regresiones;
6. actualizar documentación;
7. indicar si requiere `npx prisma db push`.

El siguiente bloque de trabajo acordado es **Menú**. Después se revisarán **Integraciones**. Autenticación y Roles continúa como bloque estratégico pendiente.
