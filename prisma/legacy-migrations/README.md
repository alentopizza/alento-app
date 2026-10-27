# Migraciones históricas pre-baseline

Este directorio conserva las migraciones que existían antes de formalizar Prisma Migrate en producción el 2026-10-26.

## Importante

Prisma **no** debe ejecutar estos archivos como historial activo.

La historia activa vive únicamente en:

`prisma/migrations/`

Baseline activa:

`20261026190500_baseline`

## Por qué se conservan

Algunas migraciones antiguas incluyen backfills o transformaciones de datos que ya fueron ejecutadas históricamente en producción, por ejemplo:

- normalización de `preparedQuantity`;
- creación retroactiva de movimientos de Club Puntos;
- relleno de `deliveredAt`/ganancias de repartidor;
- unificación de suscripciones Push;
- endurecimiento de `staffOptIn`.

El baseline actual representa el **estado final del schema**, pero no vuelve a ejecutar estos backfills sobre instalaciones nuevas.

Se conservan aquí para trazabilidad técnica y auditoría histórica.

## No hacer

- no mover estos directorios de vuelta a `prisma/migrations`;
- no ejecutar todos estos SQL en una instalación nueva;
- no usarlos como mecanismo de despliegue futuro.

Toda evolución nueva del schema debe crear una migración nueva después de `20261026190500_baseline`.
