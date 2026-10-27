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

Pipeline actual:

```text
npm ci
prisma validate
prisma migrate deploy sobre PostgreSQL efímero
prisma migrate diff (cero drift)
npm run lint
npm run typecheck
npm test
npm run build
```

Reglas:

- CI nunca usa la base de producción;
- usa PostgreSQL efímero;
- usa secretos ficticios de runner;
- ejecuta la suite crítica de tests.

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

Validación final:

- redeploy de producción ejecutado por el usuario;
- build EasyPanel terminado en **Success**;
- aplicación confirmada operativa por el usuario;
- baseline y start definitivo quedan cerrados.

**Punto #4 cerrado. No iniciar el punto #5 hasta autorización explícita del usuario.**

---

### 5. Backups y restauración verificada — ✅ COMPLETADO

Objetivo:

- documentar backup PostgreSQL;
- definir retención;
- definir RPO/RTO;
- realizar una prueba real de restauración sin tocar producción.

Documento canónico:

`docs/BACKUPS_AND_RECOVERY.md`

Objetivos definidos:

- RPO: **1 hora**;
- RTO: **2 horas**.

Configuración operativa:

- Google Drive remoto: `Alentó Pizza Backups`;
- horario: `15 * * * *`, retención 48;
- diario: `30 8 * * *` UTC (~03:30 Bogotá), retención 30;
- rutas separadas `hourly` / `daily`.

Validación real:

- Manual Run horario: exitoso;
- archivo remoto confirmado en Google Drive;
- Manual Run diario: exitoso;
- archivo remoto confirmado;
- restore ejecutado sobre PostgreSQL temporal `alento-restore-test`;
- `npx prisma migrate status`: **Database schema is up to date!**;
- `npm run db:verify-restore`: **Database restore verification: OK**;
- datos reales leídos correctamente;
- servicio temporal eliminado después de validar.

Conteos restaurados de referencia:

- 435 clientes;
- 8 usuarios;
- 70 productos;
- 796 pedidos;
- 1127 pagos;
- 33 sesiones de Caja;
- 319 movimientos Club;
- 173 turnos.

Regla operativa:

- revisar logs de backup al menos semanalmente;
- realizar restore de prueba al menos mensualmente y tras cambios mayores de infraestructura;
- nunca probar Restore sobre `alento-db`.

**Punto #5 cerrado. No iniciar el punto #6 hasta autorización explícita del usuario.**

---

### 6. Seguridad de sesiones y rate limiting — ✅ COMPLETADO

Objetivo:

- revocación efectiva de sesiones de colaboradores;
- invalidación al desactivar usuario/cambiar permisos;
- protección contra fuerza bruta;
- rate limiting en login/OTP/endpoints públicos costosos.

Implementado:

- `User.sessionVersion`;
- migración `20261027022000_security_sessions_rate_limits`;
- middleware con runtime Node.js + Prisma;
- validación live de `active`, `sessionVersion` y roles actuales;
- migración silenciosa de cookies legacy;
- `getStaffSession()` revalida DB;
- `getCustomerSession()` revalida `CustomerAccount.active`;
- modelo persistente `SecurityRateLimit`;
- claves sensibles protegidas con HMAC;
- 429 con `Retry-After`;
- límites sobre login, bootstrap, OTP, Delivery Quote, elegibilidad y checkout WEB.

Límites vigentes:

- login staff IP: 30 / 15 min;
- login staff correo: 10 / 15 min;
- bootstrap: 10 / hora por IP;
- OTP request IP: 20 / 15 min;
- OTP request teléfono: 5 / hora;
- OTP verify IP: 30 / 15 min;
- OTP verify teléfono: 10 / 15 min;
- delivery quote: 60 / 10 min por IP;
- checkout eligibility: 120 / 10 min por IP;
- checkout create: 12 / 10 min por IP.

Validación técnica:

- Prisma migrate deploy: verde;
- drift: cero;
- ESLint: verde;
- TypeScript: verde;
- **6 archivos / 35 tests**;
- tests persistentes del limiter contra PostgreSQL efímero: verdes;
- Next build: verde;
- Quality CI run: `40435238211`.

Validación productiva:

- redeploy completado;
- migraciones aplicadas correctamente;
- Next.js llegó a `Ready`;
- login ADMIN continuó operativo;
- se inició una sesión independiente con colaborador no ADMIN;
- el colaborador fue desactivado desde ADMIN;
- en la siguiente navegación/solicitud perdió acceso inmediatamente;
- el comportamiento de revocación quedó confirmado por el usuario.

Documento canónico:

`docs/SECURITY_HARDENING.md`

**Punto #6 cerrado. No iniciar el punto #7 hasta autorización explícita del usuario.**

---

### 7. Idempotencia de operaciones críticas — 🟡 IMPLEMENTADO / PENDIENTE VALIDACIÓN PRODUCTIVA

Objetivo:

proteger creación de pedidos/pagos frente a doble clic, reintentos, timeout o retransmisiones.

Implementado:

- `Idempotency-Key` obligatorio para creación POS, creación WEB y registro de pago;
- clientes reutilizan la misma clave durante reintentos ambiguos;
- `Order.idempotencyKey` + `idempotencyHash`;
- `Payment.idempotencyKey` + `idempotencyHash`;
- índices únicos PostgreSQL;
- migración `20261027030000_order_payment_idempotency`;
- hash canónico SHA-256 por operación;
- misma clave + mismo request → replay HTTP 200;
- misma clave + request diferente → 409;
- clave ausente → 428;
- pedidos usan advisory lock transaccional por clave;
- pagos bloquean la fila de `Order` con `FOR UPDATE`;
- saldo de pago se recalcula dentro del lock;
- replays no repiten notificaciones/push/webhook.

Superficies cliente actualizadas:

- `OrderCheckoutModal` — POS;
- `PublicCheckoutCustomer` — WEB;
- `OrdersCardsDashboardV3` — pagos.

Validación técnica:

- Prisma migrate deploy: verde;
- migración idempotency aplicada en PostgreSQL efímero;
- drift: **No difference detected**;
- ESLint: verde;
- TypeScript: verde;
- **8 archivos / 44 tests**;
- prueba real de dos cobros simultáneos: solo uno queda PAID;
- replay de pago: un solo movimiento;
- advisory lock ejecutado realmente vía Prisma: verde;
- Next build: verde;
- Quality CI inicial: `40439799102`;
- Quality CI hotfix advisory lock: `40596132160`.

Documento canónico:

`docs/IDEMPOTENCY.md`

Hallazgo de primera validación productiva:

- el POS detectó que Prisma no puede deserializar el retorno PostgreSQL `void` de `pg_advisory_xact_lock()`;
- corregido usando CTE materializado que ejecuta el lock y devuelve `1::int`;
- test de integración añadido para cubrir exactamente ese camino;
- hotfix CI completamente verde.

Pendiente para cerrar:

1. redeploy productivo del hotfix;
2. confirmar migración + Next `Ready`;
3. crear pedido POS normal;
4. crear/confirmar pedido WEB normal;
5. registrar pago normal y revisar saldo/Caja;
6. confirmar que las superficies actuales no arrojan `IDEMPOTENCY_KEY_REQUIRED`.

**No iniciar el punto #8 hasta confirmar esta validación productiva.**

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

Estado actual para continuidad:

- #1 Builds reproducibles: ✅
- #2 CI automatizada: ✅
- #3 Pruebas automatizadas críticas: ✅
- #4 Baseline Prisma + migraciones seguras: ✅
- #5 Backups y restauración verificada: ✅
- #6 Seguridad de sesiones y rate limiting: ✅
- #7 Idempotencia de operaciones críticas: implementado en repositorio, pendiente de validación productiva.

Una nueva conversación debe continuar validando el #7 en producción; no iniciar #8 hasta cerrarlo.


## Hallazgos de despliegue para seguimiento posterior

Detectados en el redeploy final del punto #4:

- Nixpacks/EasyPanel continúa usando `npm install` en la fase de instalación, aunque el repositorio y CI usan `npm ci`. El lockfile sigue presente y CI protege desalineaciones, pero conviene revisar la configuración del builder en una fase futura.
- durante `next build` apareció un intento de `prisma.appSetting.findUnique()` contra PostgreSQL que falló porque el contenedor de build no alcanzó la DB; el build continuó y terminó correctamente. Conviene revisar qué ruta está intentando consultar DB durante prerender/build.
- npm reportó vulnerabilidades de dependencias; no ejecutar `npm audit fix --force` automáticamente. Revisarlas dentro del hardening de seguridad/dependencias.
