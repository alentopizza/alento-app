# Roadmap de implementación

Este documento define el orden de trabajo aprobado para Alentó App. Su objetivo es evitar cambios grandes, mezclar módulos incompletos o iniciar una fase nueva antes de cerrar la anterior.

## Regla de trabajo

El desarrollo debe avanzar en bloques pequeños y verificables.

Orden aprobado actualmente:

```text
1. Cerrar Pedidos
2. Cerrar Cocina
3. Validación conjunta Pedidos ↔ Cocina
4. Autenticación y Roles
5. Continuar módulos posteriores
```

No iniciar Autenticación y Roles hasta completar el checkpoint de Pedidos + Cocina.

---

# Fase 1 — Cerrar Pedidos

Estado: **EN CURSO**

Objetivo: que `/pedidos` sea una herramienta operativa confiable para consultar, editar y gestionar una orden durante el día a día del restaurante.

## Ya implementado

- tarjetas compactas por pedido;
- buscador y filtros;
- detalle lateral de la orden;
- visualización de configuración estructurada de productos;
- estado actual y siguiente acción operativa;
- registro de pagos reales;
- eliminación física de pagos registrados por error;
- saldo pendiente;
- edición de modalidad `DELIVERY / PICKUP / STORE`;
- cambio de tarifa de domicilio;
- modificación de cantidades;
- eliminación de líneas;
- agregado de productos simples;
- impresión térmica;
- comprobante;
- eliminación física definitiva de pedidos;
- cancelación como concepto separado de eliminación;
- consecutivo comercial global visible mediante `sequenceNumber`;
- códigos `POS-0001` y futuro `WEB-0002` compartiendo un único consecutivo.

## Pendientes de cierre

Antes de marcar Pedidos como terminado se debe validar y, si hace falta, corregir:

- que tarjeta, detalle, edición y búsquedas usen siempre el identificador comercial correcto;
- que no queden referencias visibles antiguas como `ALT-...`;
- que edición de modalidad recalculé correctamente domicilio, subtotal, descuento, total y saldo;
- que agregar productos a una orden ya pagada conserve el dinero recibido y genere únicamente saldo por la diferencia;
- que reducir una orden por debajo del dinero ya recibido sea bloqueado hasta existir una futura devolución;
- que eliminar pago actualice inmediatamente saldo y Caja;
- que eliminar pedido borre `Payment`, `OrderItem` y `Order` atómicamente;
- que cancelar pedido conserve el histórico cuando esa sea la intención;
- que las acciones de estado desde Pedidos solo se permitan cuando corresponda;
- que la interfaz sea usable en escritorio y pantallas pequeñas;
- que imprimir y comprobante utilicen el mismo pedido correcto y no creen efectos secundarios.

## Criterio de cierre de Pedidos

Pedidos se considera cerrado para esta etapa cuando se puedan probar de principio a fin, sin errores, al menos estos escenarios:

1. pedido Domicilio;
2. pedido Recoger;
3. pedido Local;
4. pedido pendiente de pago;
5. pedido pagado;
6. pago eliminado por error;
7. pedido editado antes de completarse;
8. cambio Domicilio → Recoger;
9. cambio Recoger → Domicilio;
10. agregado de una bebida/producto simple;
11. pedido cancelado conservando histórico;
12. pedido eliminado definitivamente;
13. impresión y comprobante;
14. avance de estados después de Cocina.

---

# Fase 2 — Cerrar Cocina

Estado: **EN CURSO, DESPUÉS DE PEDIDOS**

Objetivo: que Cocina pueda ejecutar la preparación real sin depender de información externa ni alterar estados incorrectamente.

## Ya implementado

- `/cocina` conectado a pedidos reales;
- pedidos `PREPARING` y `PREPARED`;
- productos estructurados visibles;
- control `preparedQuantity` por línea;
- cantidades múltiples `0/N → N/N`;
- cambio automático `PREPARING → PREPARED` cuando todas las unidades terminan;
- acción manual `PREPARED → READY`;
- ordenamiento por antigüedad;
- minutos transcurridos;
- progreso total de preparación;
- refresco periódico;
- consecutivo comercial visible (`POS-0001`, etc.).

## Pendientes de cierre

Antes de marcar Cocina como terminada se debe validar:

- que pizzas, pizzas de dos sabores, combos y productos simples se interpreten correctamente;
- que cantidades múltiples se puedan preparar unidad por unidad;
- que completar todas las líneas pase automáticamente a `PREPARED` una sola vez;
- que revertir una cantidad preparada devuelva `PREPARED → PREPARING` cuando corresponda;
- que `Marcar como listo` solo funcione desde `PREPARED`;
- que una orden `READY` desaparezca de Cocina;
- que las ediciones realizadas desde Pedidos no permitan saltarse preparación;
- que si se agregan productos a una orden avanzada, el pedido vuelva a `PREPARING` cuando corresponda;
- que Cocina nunca necesite editar precios, pagos o datos financieros;
- que la interfaz sea legible y rápida en una pantalla de cocina.

## Criterio de cierre de Cocina

Cocina se considera cerrada para esta etapa cuando funcionen sin errores estos escenarios:

1. producto simple cantidad 1;
2. producto cantidad 2 o más;
3. pizza configurada;
4. pizza de dos sabores;
5. combo con varios componentes;
6. pedido con varias líneas;
7. completar parcialmente una orden;
8. completar toda la orden y obtener `PREPARED`;
9. revertir una unidad preparada;
10. completar nuevamente;
11. marcar `READY`;
12. confirmar que desaparece de Cocina y continúa en Pedidos.

---

# Checkpoint — Pedidos + Cocina

Estado: **PENDIENTE**

Este checkpoint se ejecuta antes de iniciar autenticación.

Prueba integrada recomendada:

```text
Crear pedido en POS
→ PREPARING
→ aparece en Pedidos
→ aparece en Cocina
→ preparar unidades
→ PREPARED
→ marcar READY
→ continuar estados desde Pedidos
→ registrar pago
→ verificar Caja
→ imprimir comprobante
→ finalizar
```

También probar una edición realista:

```text
Crear pedido
→ agregar una bebida desde Pedidos
→ pedido vuelve/permanece en PREPARING según corresponda
→ Cocina ve el nuevo producto
→ completa preparación
→ READY
```

Solo después de aprobar este checkpoint se inicia la siguiente fase.

---

# Fase 3 — Autenticación y Roles

Estado: **PRÓXIMAMENTE — NO INICIAR AÚN**

Documento de diseño: `docs/AUTH_ROLES_AND_PUBLIC_APP.md`.

Orden aprobado de implementación:

1. agregar `User` y `UserRole` a Prisma;
2. definir la solución de autenticación;
3. implementar hash seguro de contraseñas;
4. implementar login;
5. implementar logout;
6. implementar sesión segura;
7. proteger una ruta piloto, preferiblemente Cocina;
8. proteger todas las páginas internas;
9. proteger las APIs internas;
10. aplicar autorización por rol en servidor;
11. adaptar navegación según permisos;
12. crear administración de usuarios para `ADMIN`;
13. validar desactivación de usuarios;
14. documentar variables de entorno y despliegue;
15. probar accesos permitidos y denegados por cada rol.

Roles iniciales previstos:

- `ADMIN`
- `POS`
- `KITCHEN`
- `CASHIER`
- `DISPATCH`

Clientes y empleados deben seguir siendo entidades separadas.

---

# Fase 4 — Después de autenticación

Orden tentativo, sujeto a decisión antes de iniciar cada bloque:

- cerrar Caja, conciliación y cierres;
- devoluciones/reembolsos;
- auditoría de acciones sensibles;
- inventario;
- recetas;
- costos y rentabilidad;
- integraciones de atención como Chatwoot;
- experiencia pública de pedidos;
- sustitución de Glide;
- migración de `alentopizza.com` a Alentó App;
- parametrización adicional para replicar/comercializar la solución.

---

# Dominio objetivo

Durante construcción `alentopizza.com` continúa servido por Glide y Alentó App puede operar mediante infraestructura temporal.

Cuando el producto esté listo:

```text
alentopizza.com/        → experiencia pública
alentopizza.com/interno → sistema de empleados protegido
```

No se planea un dominio distinto por módulo.

---

# Regla para futuros desarrolladores o IA

Antes de comenzar un nuevo cambio:

1. leer `docs/ROADMAP.md`;
2. identificar la fase activa;
3. no implementar tareas de una fase posterior salvo decisión explícita;
4. hacer cambios pequeños;
5. probar el cambio antes de continuar;
6. actualizar documentación en el mismo bloque;
7. indicar si el cambio requiere `npx prisma db push`;
8. no considerar una fase terminada hasta cumplir su criterio de cierre.

La prioridad actual es **terminar Pedidos y Cocina**, no iniciar todavía Autenticación y Roles.