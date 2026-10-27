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

### 3. Pruebas automatizadas críticas — ✅ COMPLETADO

Objetivo:

crear una suite inicial que proteja reglas de negocio críticas antes de continuar ampliando el sistema.

Implementado:

- Vitest `3.2.4` con versión fija;
- `vitest.config.ts` con alias `@ -> src`;
- script `npm test = vitest run`;
- paso **Tests** dentro de `.github/workflows/quality-ci.yml`;
- tests deterministas sin depender de Google, WhatsApp ni servicios externos;
- mocks controlados para proteger la normalización de precios sin tocar producción.

Cobertura actual:

- `src/lib/clubAlento.test.ts`
  - configuración y límites de Club;
  - acumulación de puntos;
  - conversión de porcentaje.
- `src/lib/orderScheduling.test.ts`
  - fecha futura;
  - ventana de Cocina de 30 minutos;
  - estado inicial;
  - horario Bogotá;
  - horario nocturno;
  - días cerrados.
- `src/lib/deliveryPricing.test.ts`
  - coordenadas;
  - bandas;
  - cobertura;
  - tarifas;
  - errores operativos.
- `src/lib/orderWorkflow.test.ts`
  - flujo DELIVERY/PICKUP/STORE;
  - transiciones;
  - etiquetas;
  - prefijos/códigos.
- `src/lib/orderLineNormalizer.test.ts`
  - precio canónico de producto estándar;
  - elegibilidad de cupón;
  - producto no disponible;
  - Arma Tu Pizza cobra la mitad con más ingredientes;
  - en empate cobra la mitad de mayor valor.

Validación final:

- **5 archivos de pruebas**;
- **31 tests pasaron**;
- ejecución en CI: **1.91 s** para la suite;
- `npm ci`: verde;
- Prisma: verde;
- ESLint: verde;
- TypeScript: verde;
- Tests: verde;
- Next build: verde.

CI verde de referencia:

- workflow run `40421076661`;
- commit funcional de cobertura de precios: `8c603b387649f8df1138f33da6310d8f2587ead0`.

Regla desde ahora:

toda corrección o nueva regla de negocio que pueda afectar dinero, estados, horarios, descuentos, puntos o cobertura debe añadir/ajustar una prueba cuando exista una superficie testeable.

**No avanzar al punto 4 hasta que el usuario autorice explícitamente continuar.**

---

### 4. Baseline Prisma + migraciones seguras — ✅ COMPLETADO

Objetivo:

- dejar de depender de `prisma db push` durante cada arranque;
- formalizar el estado actual de producción;
- pasar a una estrategia segura basada en migraciones.

#### Fase A — repositorio ✅

Completado:

- se comprobó que las 23 migraciones históricas no forman una historia completa desde cero;
- se generó `20261026190500_baseline` desde DB vacía → schema actual;
- baseline de 1205 líneas validada sobre PostgreSQL 16;
- drift posterior: **No difference detected**;
- 23 migraciones previas archivadas en `prisma/legacy-migrations/`;
- Quality CI ahora usa `prisma migrate deploy` y comprueba drift;
- CI completo verde con lint, TypeScript, 31 tests y build;
- runbook operativo creado en `docs/PRISMA_BASELINE.md`.

#### Fase B — producción ✅

Validado directamente en producción:

- drift check: **No difference detected**;
- baseline registrada con `prisma migrate resolve --applied 20261026190500_baseline`;
- `prisma migrate status`: **Database schema is up to date!**;
- `prisma migrate deploy`: **No pending migrations to apply.**

#### Fase C — cambio definitivo ✅

El start productivo quedó cambiado a:

```bash
prisma migrate deploy && next start -p 3000
```

También se añadió:

```bash
npm run prisma:migrate:deploy
```

A partir de este punto `prisma db push` deja de ser el mecanismo normal de producción.

Validación final pendiente únicamente del redeploy operativo del usuario con este nuevo start.

**No iniciar el punto 5 hasta que el usuario confirme que el redeploy final arrancó correctamente.**

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

`4. Baseline Prisma + migraciones seguras — PENDIENTE`

los puntos #1, #2 y #3 ya están cerrados. Una nueva conversación debe esperar autorización explícita del usuario antes de iniciar el #4.
