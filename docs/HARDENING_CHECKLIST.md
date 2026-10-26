# Plan de hardening y calidad

Última actualización: **2026-10-26**.

Este documento es el checklist operativo del ciclo de calidad iniciado después de consolidar la funcionalidad principal de Alentó App.

## Regla de trabajo

Trabajar **un solo punto a la vez**.

No iniciar el siguiente punto hasta que:

1. el cambio esté implementado en `main`;
2. la validación técnica correspondiente termine correctamente;
3. la documentación quede actualizada;
4. cuando el cambio afecte producción, el usuario confirme que fue desplegado y funciona;
5. el usuario autorice explícitamente continuar.

Si una conversación termina o alcanza su límite, una nueva conversación debe leer:

1. `AGENTS.md`;
2. `docs/HANDOFF.md`;
3. este documento;
4. `docs/CURRENT_STATE.md`;
5. commits recientes de `main`.

Después se debe continuar exactamente desde el primer punto no marcado como completado.

## Checklist maestro

### 1. Builds reproducibles — ✅ COMPLETADO

Objetivo:

- versionar un lockfile real;
- usar instalaciones deterministas.

Implementado:

- `package-lock.json` lockfile v3;
- instalación oficial mediante `npm ci`;
- lockfile validado desde runner limpio con Node 22/npm;
- documentación de actualización conjunta `package.json + package-lock.json`.

Commit principal:

`248478234a65127317f831d76390e30aa216b963`

Validación:

- `npm ci` completó correctamente;
- `postinstall -> prisma generate` completó correctamente;
- desplegado por el usuario y confirmado operativo.

---

### 2. CI automatizada — ✅ COMPLETADO

Objetivo:

detectar antes del despliegue errores de dependencias, Prisma, lint, tipos y compilación.

Implementado:

`.github/workflows/quality-ci.yml`

Disparadores:

- push a `main`;
- pull request;
- ejecución manual.

Pipeline:

```text
npm ci
prisma validate
prisma db push sobre PostgreSQL 16 efímero
npm run lint
npm run typecheck
npm run build
```

Reglas:

- CI nunca usa la base de producción;
- usa PostgreSQL efímero;
- usa secretos ficticios de runner;
- no incluye todavía tests.

Primera corrida:

- detectó tres errores de lint de scripts históricos CommonJS;
- se ajustó ESLint sin modificar esos scripts;
- ejecución posterior terminó completamente verde.

Commit verde de referencia:

`6ef55a59f3714689af6488c5c7873cef3cf3313b`

---

### 3. Pruebas automatizadas críticas — 🟡 EN CURSO

Objetivo:

crear una suite inicial que proteja reglas de negocio críticas antes de continuar ampliando el sistema.

Alcance de este punto:

- incorporar un runner de tests mantenible;
- añadir script `npm test`;
- ejecutar tests dentro de Quality CI;
- cubrir primero lógica pura y determinista con alto impacto operacional;
- evitar tests frágiles basados únicamente en snapshots visuales.

Cobertura inicial prioritaria:

- reglas de Club Puntos;
- programación/ventanas de pedidos;
- cálculo de domicilio/cobertura cuando sea testeable sin servicios externos;
- códigos/formatos y reglas puras de pedidos;
- otras reglas puras críticas detectadas durante implementación.

Después de esa base se evaluará si dentro del mismo punto hace falta una pequeña capa de integración contra PostgreSQL efímero para proteger creación/normalización de pedidos.

Criterio de cierre:

- tests pasan localmente/en runner;
- Quality CI ejecuta los tests;
- una regresión intencional demostrable haría fallar la suite;
- CI final queda verde;
- documentación actualizada.

**No avanzar al punto 4 hasta cerrar este punto y recibir autorización del usuario.**

---

### 4. Baseline Prisma + migraciones seguras — ⬜ PENDIENTE

Objetivo:

- dejar de depender de `prisma db push` durante cada arranque;
- formalizar el estado actual de producción;
- pasar a una estrategia segura basada en migraciones.

No tocar hasta cerrar punto 3.

---

### 5. Backups y restauración verificada — ⬜ PENDIENTE

Objetivo:

- documentar backup PostgreSQL;
- definir retención;
- definir RPO/RTO;
- realizar una prueba real de restauración sin tocar producción.

---

### 6. Seguridad de sesiones y rate limiting — ⬜ PENDIENTE

Objetivo:

- revocación efectiva de sesiones de colaboradores;
- invalidación al desactivar usuario/cambiar permisos;
- protección contra fuerza bruta;
- rate limiting en login/OTP/endpoints públicos costosos.

---

### 7. Idempotencia de operaciones críticas — ⬜ PENDIENTE

Objetivo:

proteger creación de pedidos/pagos frente a doble clic, reintentos, timeout o retransmisiones.

---

### 8. Audit Log — ⬜ PENDIENTE

Objetivo:

registrar de forma central acciones sensibles:

- descuentos;
- cambios/eliminaciones de pedido;
- pagos;
- caja;
- roles;
- configuración;
- otras operaciones financieras/administrativas.

---

### 9. Observabilidad de producción — ⬜ PENDIENTE

Objetivo:

- errores frontend/backend;
- logs estructurados;
- request IDs;
- alertas;
- monitoreo de integraciones y jobs;
- complementar `/api/health`.

---

### 10. Refund / devoluciones auditables — ⬜ PENDIENTE

Objetivo:

cerrar correctamente el ciclo financiero de pagos recibidos y devoluciones, con impacto consistente en Caja y trazabilidad.

---

## Trabajo posterior al checklist

Solo después de cerrar los puntos anteriores se reevalúa el orden de:

- refactor gradual de componentes grandes;
- validación API estandarizada;
- error boundaries;
- accesibilidad;
- PWA/assets residuales;
- headers de seguridad;
- privacidad/gobierno del dato;
- canje transaccional Club;
- inventario, recetas, costos y rentabilidad.

No introducir estos trabajos dentro de un punto anterior salvo que sean estrictamente necesarios para completarlo.

## Estado para una nueva conversación

Si este archivo indica:

`3. Pruebas automatizadas críticas — EN CURSO`

la nueva conversación debe continuar únicamente con ese punto, revisar commits recientes y no iniciar Prisma baseline, seguridad, backups u otros puntos hasta que el #3 quede cerrado y el usuario autorice avanzar.
