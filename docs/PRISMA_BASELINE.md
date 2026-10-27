# Baseline Prisma de producción

Última actualización: **2026-10-26**.

Este documento describe el procedimiento único para convertir la base de producción de Alentó App, creada originalmente con `prisma db push`, a un historial formal de Prisma Migrate.

## Estado

**Baseline completada en producción el 2026-10-26.**

Resultados reales:

- drift check: `No difference detected.`;
- baseline marcada como aplicada;
- `prisma migrate status`: `Database schema is up to date!`;
- `prisma migrate deploy`: `No pending migrations to apply.`;
- el repositorio ya usa `prisma migrate deploy && next start -p 3000`.

El procedimiento siguiente queda como referencia/auditoría de cómo se realizó el baseline.

## Baseline

Baseline activa del repositorio:

`20261026190500_baseline`

Archivo:

`prisma/migrations/20261026190500_baseline/migration.sql`

El SQL fue generado desde:

`empty PostgreSQL -> prisma/schema.prisma`

Validación previa realizada:

- 1205 líneas;
- aplicada correctamente sobre PostgreSQL 16 vacío;
- `prisma migrate deploy` terminó correctamente;
- `prisma migrate diff` posterior devolvió **No difference detected**;
- Quality CI aplica actualmente la baseline mediante `prisma migrate deploy` y verifica drift.

Las 23 migraciones previas se conservan en:

`prisma/legacy-migrations/`

No deben volver a moverse a `prisma/migrations`. Algunas contienen backfills históricos de datos y se mantienen exclusivamente como evidencia/auditoría de la evolución anterior.

## Por qué hay que marcar la baseline

Producción ya contiene las tablas, columnas, índices y enums representados por la baseline.

Por eso **NO se debe ejecutar el SQL de la baseline sobre producción**.

El procedimiento correcto es registrar ante Prisma que esa migración ya está aplicada:

```bash
npx prisma migrate resolve --applied 20261026190500_baseline
```

Ese comando registra la migración en `_prisma_migrations`; no recrea las tablas.

## Requisitos antes de ejecutar

1. desplegar un commit que ya contenga `prisma/migrations/20261026190500_baseline`;
2. confirmar que la aplicación sigue levantando con el start todavía vigente:
   `prisma db push && next start -p 3000`;
3. tomar un snapshot/backup previo de PostgreSQL si EasyPanel/VPS lo permite;
4. abrir una terminal/shell del servicio donde `DATABASE_URL` ya apunte a producción.

Este snapshot es una protección puntual del cambio. La estrategia permanente de backups pertenece al punto #5 del checklist.

## Paso 1 — comprobar drift real

Ejecutar:

```bash
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --exit-code
```

### Resultado permitido

Debe terminar con:

```text
No difference detected.
```

y exit code 0.

### Si aparecen diferencias

**DETENERSE.**

No ejecutar `migrate resolve` y no cambiar el comando de start.

Guardar/copiar la salida completa para analizar el drift.

## Paso 2 — registrar baseline como aplicada

Solo si el paso 1 terminó sin diferencias:

```bash
npx prisma migrate resolve --applied 20261026190500_baseline
```

Resultado esperado: Prisma confirma que la migración fue marcada como aplicada.

Este comando no ejecuta las 1205 líneas del baseline sobre las tablas existentes.

## Paso 3 — verificar historial

Ejecutar:

```bash
npx prisma migrate status
```

Resultado esperado:

```text
Database schema is up to date!
```

También debe reconocer la migración:

`20261026190500_baseline`

## Paso 4 — prueba de deploy sin cambios

Ejecutar:

```bash
npx prisma migrate deploy
```

Resultado esperado:

- no intenta crear las tablas existentes;
- no hay migraciones pendientes;
- termina correctamente.

## Paso 5 — validar aplicación

Sin modificar todavía el start:

- abrir `/api/health`;
- abrir Menú;
- abrir POS;
- abrir Pedidos;
- abrir Carrito.

No se requiere crear datos de prueba si la operación normal ya permite validar estas vistas.

## Paso final en código — completado

Después de confirmar los pasos anteriores en producción se cambió:

```bash
prisma db push && next start -p 3000
```

por:

```bash
prisma migrate deploy && next start -p 3000
```

Luego redeploy y confirmar:

- `prisma migrate deploy` termina correctamente;
- Next.js muestra `Ready`;
- `GET /api/health` responde correctamente.

El punto #4 queda técnicamente completado; falta únicamente confirmar el primer redeploy operativo usando el nuevo start.

## Migraciones futuras

Después del baseline:

- todo cambio de `prisma/schema.prisma` debe tener una migración nueva;
- producción se actualiza mediante `prisma migrate deploy`;
- no volver a usar `prisma db push` como mecanismo normal de producción;
- Quality CI debe seguir reconstruyendo una DB vacía exclusivamente desde `prisma/migrations` y comprobar cero drift.

## Prohibiciones

No ejecutar en producción:

```bash
prisma migrate reset
```

No borrar:

- `_prisma_migrations`;
- `20261026190500_baseline`.

No ejecutar manualmente `migration.sql` de la baseline sobre producción.

No volver a copiar las migraciones archivadas a `prisma/migrations`.
