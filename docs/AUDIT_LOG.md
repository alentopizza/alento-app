# Audit Log central de Alentó App

Última actualización: **2026-10-27**.

Estado: **IMPLEMENTADO Y VALIDADO EN PRODUCCIÓN — hardening #8 COMPLETADO**.

Este documento define la auditoría de negocio para operaciones sensibles de Alentó Pizza.

El Audit Log no sustituye logs técnicos ni observabilidad. Su objetivo es responder preguntas como:

- quién cambió un rol;
- quién aplicó un descuento;
- quién registró o eliminó un pago;
- quién abrió/cerró Caja;
- quién eliminó un pedido;
- qué cambió antes y después;
- cuándo ocurrió.

## Modelo

Prisma:

`AuditLog`

Campos:

- `id`;
- `occurredAt`;
- `actorType`;
- `actorUserId`;
- `actorName`;
- `actorEmail`;
- `action`;
- `entityType`;
- `entityId`;
- `summary`;
- `before`;
- `after`;
- `metadata`;
- `source`.

No existe FK desde `AuditLog.actorUserId` a `User`.

La decisión es deliberada: el historial debe conservarse aunque un colaborador cambie de nombre, correo o deje de existir.

## Inmutabilidad

La aplicación no expone endpoints para editar ni borrar registros de auditoría.

Además PostgreSQL aplica:

`AuditLog_append_only`

Este trigger rechaza cualquier:

- UPDATE;
- DELETE.

La protección existe en la base de datos y no depende únicamente de disciplina de código.

Migración:

`20261027224500_central_audit_log`

## Escritura transaccional

Helper canónico:

`src/lib/auditLog.ts`

Función:

`writeAuditLog(db, input)`

Cuando una operación de negocio ya utiliza una transacción Prisma, el Audit Log se escribe dentro de esa misma transacción.

Resultado:

```text
operación + auditoría → commit juntas
operación o auditoría falla → rollback completo
```

No se considera aceptable que un cambio financiero o administrativo importante se confirme sin dejar la huella correspondiente.

## Actor

Tipos vigentes:

- `STAFF`;
- `CUSTOMER`;
- `GUEST`;
- `SYSTEM`.

Para colaboradores se congela:

- userId;
- nombre;
- correo.

Para compras WEB con cupón:

- cliente autenticado → `CUSTOMER`;
- invitado → `GUEST`.

## Privacidad y secretos

Los snapshots pasan por sanitización recursiva.

No se almacenan claves como:

- password / passwordHash;
- token / accessToken / refreshToken;
- authorization;
- secret;
- codeHash;
- p256dh;
- fcmToken;
- idempotencyHash;
- apiKey;
- privateKey;
- clientSecret;
- sharedSecret;
- signature.

También se detectan variantes con guiones/underscore y sufijos sensibles.

No guardar deliberadamente:

- contraseñas;
- credenciales;
- llaves privadas;
- códigos OTP;
- referencias completas de pago cuando no sean necesarias para explicar la acción.

## Cobertura implementada

### Usuarios y permisos

Eventos:

- `USER_CREATED`;
- `USER_UPDATED`.

Registra:

- actor ADMIN;
- roles;
- permisos;
- activo/inactivo;
- email/nombre;
- cambio de versión de sesión;
- indicador de cambio de contraseña sin guardar la contraseña.

### Pedidos

Eventos:

- `ORDER_CANCELED`;
- `ORDER_UPDATED`;
- `ORDER_CUSTOMER_CHANGED`;
- `ORDER_STATUS_CHANGED`;
- `ORDER_DELETED`;
- `ORDER_DISCOUNT_APPLIED`.

Se auditan:

- edición estándar;
- editor estructurado;
- cambios de modalidad;
- cambios de cliente/dirección mediante IDs;
- cancelación;
- eliminación definitiva;
- transición de estados;
- descuentos manuales;
- cupones POS;
- cupones WEB.

Para eliminación definitiva, el Audit Log se escribe dentro de la misma transacción después de borrar Order. Como no existe FK hacia Order, la huella sobrevive al borrado.

No se duplican teléfonos ni direcciones completas dentro del log.

### Cobertura de transiciones automáticas de Cocina

La transición a `PREPARED` (visible como **Horneando**) puede ocurrir por dos caminos:

- cambio manual desde Pedidos mediante `/api/orders/[id]/status`;
- cambio automático desde Cocina cuando todas las líneas quedan preparadas mediante `/api/orders/[id]/items/[itemId]/prepared`.

Ambos caminos escriben `ORDER_STATUS_CHANGED`.

También se auditan las transiciones operativas realizadas desde el enlace/app del repartidor:

- `OUT_FOR_DELIVERY`;
- `ARRIVED`;
- `DELIVERED`.

El origen queda identificado en metadata/source para distinguir Pedidos, Cocina y Repartidor.

### Pagos

Eventos:

- `PAYMENT_CREATED`;
- `PAYMENT_DELETED`.

Registra:

- pedido;
- método;
- monto;
- efectivo entregado/cambio cuando aplica;
- total pagado antes/después;
- saldo posterior.

La referencia de pago no se replica en AuditLog.

Los replays idempotentes no crean un segundo evento de auditoría.

### Caja

Eventos:

- `CASH_SESSION_OPENED`;
- `CASH_OPENING_UPDATED`;
- `CASH_SESSION_CLOSED`;
- `CASH_INCOME_CREATED`;
- `CASH_INCOME_DELETED`;
- `CASH_EXPENSE_CREATED`;
- `CASH_EXPENSE_UPDATED`;
- `CASH_EXPENSE_DELETED`;
- `DRIVER_PAYOUT_CREATED`;
- `CASH_LOAN_CREATED`;
- `CASH_LOAN_REPAYMENT_CREATED`;
- `PAYROLL_PAID`;
- `PAYROLL_REVERSED`.

El borrador automático del cierre de Caja **no se audita** para evitar cientos de registros sin valor. Solo se audita el cierre definitivo.

### Cupones

Eventos:

- `COUPON_CREATED`;
- `COUPON_UPDATED`;
- `COUPON_DELETED`.

Se guardan valores comerciales, activación y visibilidad POS/WEB.

### Configuración administrativa

Eventos:

- `SETTINGS_UPDATED`;
- `CLUB_SETTINGS_UPDATED`;
- `PUBLIC_HOME_SETTINGS_UPDATED`;
- `TRACKING_SETTINGS_UPDATED`.

Incluye:

- configuración operativa del POS;
- Club Alentó;
- home/personalización pública;
- métricas/tracking.

Todos los snapshots pasan primero por el sanitizador de secretos.

## Alcance de Menú/Catálogo

El hardening #8 cubre las operaciones sensibles definidas en el checklist:

- dinero;
- pedidos;
- descuentos;
- Caja;
- permisos;
- cupones;
- configuración.

El editor completo de catálogo/recetas no se instrumenta masivamente dentro de este punto para evitar acoplar un módulo amplio y heterogéneo a un cambio de seguridad financiera.

Regla desde ahora:

> cualquier nueva operación administrativa o financiera sensible debe usar el framework central de AuditLog.

Una ampliación de auditoría detallada de catálogo/precios puede realizarse como extensión posterior del mismo sistema.

## Consulta administrativa

Ruta:

`/auditoria`

Acceso:

**solo ADMIN**.

API:

`GET /api/audit-logs`

También protegida:

- por middleware;
- por `requireStaffSession(["ADMIN"])`.

Filtros disponibles:

- acción;
- tipo de entidad;
- actor/resumen;
- fecha desde;
- fecha hasta.

La UI muestra:

- acción;
- entidad;
- actor;
- fecha/hora Bogotá;
- resumen;
- before/after;
- metadata;
- source técnico.

No hay controles de editar o eliminar.

## Presentación en español Colombia

La interfaz de Auditoría usa **español de Colombia (`es-CO`)**.

Fuente compartida:

`src/lib/auditPresentation.ts`

La capa de presentación traduce:

- acciones;
- entidades;
- estados;
- tipos de pedido;
- actor genérico;
- orígenes técnicos;
- claves frecuentes de before/after/metadata.

Ejemplos:

- `ORDER_STATUS_CHANGED` → **Estado del pedido actualizado**;
- `PAYMENT_CREATED` → **Pago registrado**;
- `PREPARED` → **Horneando**;
- `READY` → **Listo**;
- `DELIVERY` → **Domicilio**;
- `POS` → **Punto de venta**.

Los valores persistidos **no se traducen en la base**. Esto evita romper consultas, integraciones, migraciones y compatibilidad histórica.

Los registros antiguos también se traducen al mostrarse.

## Índices

El modelo incluye índices para:

- fecha;
- entidad + id + fecha;
- actor + fecha;
- acción + fecha.

La vista ADMIN limita el número de resultados devueltos para evitar consultas sin límite.

## Backups

`scripts/verify-database-restore.js` incluye ahora:

`auditLogs`

dentro de los conteos del restore.

Esto permite confirmar en futuras pruebas de recuperación que la trazabilidad también está presente.

## Pruebas automatizadas

Archivo:

`src/lib/auditLog.test.ts`

Valida:

- sanitización recursiva;
- ocultación de password/token/secret/apiKey/clientSecret;
- normalización de fechas;
- escritura real contra PostgreSQL efímero;
- actor y snapshots persistidos;
- rechazo real de UPDATE;
- rechazo real de DELETE;
- permanencia del registro después de ambos intentos.

Quality CI de referencia antes del último refuerzo del sanitizador:

- migración AuditLog aplicada;
- drift: cero;
- ESLint: verde;
- TypeScript: verde;
- **10 archivos / 51 tests**;
- build: verde;
- run: `40605413080`.

El refuerzo final de sanitización y restore verification también quedó verde en CI.

## Hallazgo durante la primera validación productiva

La primera prueba real mostró un pedido que llegó a **Horneando** sin generar auditoría.

Causa:

- Cocina cambia automáticamente `Order.status` a `PREPARED` al completar todas las líneas;
- ese endpoint escribía el estado directamente y no pasaba por el handler general de estados que ya estaba auditado.

Corrección:

- el cambio automático Cocina → Horneando ahora escribe `ORDER_STATUS_CHANGED` dentro de la misma transacción;
- se aprovechó la revisión para cubrir también las transiciones de estado ejecutadas desde Repartidor;
- el punto #8 permanece abierto hasta validar este hotfix en producción.

## Validación productiva — completada

Validación realizada el **27 de octubre de 2026**:

1. migración `20261027224500_central_audit_log` aplicada correctamente en producción;
2. Next.js inició en estado `Ready`;
3. `/auditoria` abrió correctamente con sesión ADMIN;
4. la primera prueba detectó un camino no auditado hacia `PREPARED` desde Cocina;
5. se corrigió Cocina y también se cubrieron transiciones de Repartidor;
6. después del hotfix se confirmó un evento real:
   - acción interna: `ORDER_STATUS_CHANGED`;
   - pedido comercial: **#801**;
   - cambio: `PREPARED → READY`;
   - presentación visible: **Horneando → Listo**;
   - actor: Alentó Pizza;
7. también se confirmó un pago real:
   - acción interna: `PAYMENT_CREATED`;
   - valor: **$14.900 COP**;
   - medio: **Efectivo**;
   - actor y origen correctos;
8. Pedidos y Pagos continuaron operando normalmente.

La inmutabilidad UPDATE/DELETE permanece cubierta por tests contra PostgreSQL y no se prueba manualmente en producción.

**El hardening #8 queda cerrado.**

CI final de cierre: `40605413080` — 10 archivos / 51 tests, cero drift y build verde.

## Reglas de no regresión

- AuditLog es append-only;
- no crear API DELETE/PATCH para auditoría;
- no guardar secretos;
- no guardar passwords ni hashes;
- no duplicar referencias sensibles de pago;
- registrar actor snapshot;
- escribir en la misma transacción cuando sea posible;
- no auditar autosaves ruidosos;
- no usar AuditLog como sistema de observabilidad técnica;
- no registrar un replay idempotente como una nueva acción financiera;
- nuevas acciones sensibles deben incorporar `writeAuditLog`.
