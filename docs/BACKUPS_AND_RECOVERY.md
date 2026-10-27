# Backups y restauración verificada

Última actualización: **2026-10-26**.

Estado: **IMPLEMENTADO Y RESTAURACIÓN VERIFICADA — hardening #5 COMPLETADO**.

Este documento define la política de respaldo y recuperación de la base PostgreSQL de Alentó App.

## Objetivo

Un backup no se considera confiable hasta que:

1. se genera automáticamente;
2. se almacena fuera del servidor de EasyPanel;
3. existe una política de retención;
4. se puede restaurar en una base separada;
5. la aplicación/Prisma puede leer correctamente la copia restaurada.

## Datos protegidos

Servicio productivo:

- proyecto EasyPanel: `app_alento`;
- PostgreSQL: `alento-db`;
- base operativa: `alento`.

PostgreSQL contiene, entre otros:

- pedidos;
- pagos;
- clientes;
- catálogo;
- Caja;
- préstamos;
- nómina/turnos;
- Club Puntos;
- configuración;
- imágenes persistidas en DB;
- usuarios y autenticación;
- métricas y notificaciones persistidas.

Por esto el backup de PostgreSQL es crítico para la operación.

## Objetivos de recuperación

### RPO — Recovery Point Objective

**1 hora.**

En un desastre total, el objetivo es perder como máximo aproximadamente una hora de cambios de base de datos.

### RTO — Recovery Time Objective

**2 horas.**

El objetivo operativo es poder disponer de una base restaurada y validada en menos de dos horas después de declarar un incidente de pérdida de datos.

Estos son objetivos internos de operación, no una garantía contractual del proveedor.

## Estrategia

Usar los backups lógicos nativos del servicio PostgreSQL de EasyPanel.

No usar como sustituto:

- copia directa del directorio vivo de PostgreSQL;
- volumen del mismo servidor como única copia;
- exportaciones CSV parciales;
- `prisma db push`;
- dumps guardados solamente dentro del contenedor.

### Destino

El destino principal debe ser **remoto y externo al VPS/EasyPanel**.

Opciones soportadas por EasyPanel incluyen S3/S3-compatible, Cloudflare R2, Google Drive, Dropbox, FTP/SFTP, entre otras.

No usar Local como única copia productiva.

## Política de backup

Crear **dos configuraciones independientes** apuntando a rutas distintas del mismo proveedor remoto.

### 1. Backup horario

Objetivo: RPO corto.

Cron:

```cron
15 * * * *
```

Retención:

```text
48 archivos
```

Esto conserva aproximadamente las últimas 48 horas de puntos horarios.

Ruta remota sugerida:

```text
alento/production/postgres/hourly
```

### 2. Backup diario

Objetivo: historial de recuperación más largo.

Ejecutar una vez al día en horario de baja actividad. Ajustar el cron según la zona horaria real del servidor para que corresponda aproximadamente a **03:30 a. m. de Bogotá**.

Retención:

```text
30 archivos
```

Ruta remota sugerida:

```text
alento/production/postgres/daily
```

Nunca compartir una misma ruta entre ambas configuraciones porque la limpieza por retención considera todos los archivos del destino.

## Primera activación

En EasyPanel:

1. abrir **Settings → Storage Providers**;
2. añadir el proveedor remoto;
3. comprobar que puede listar, escribir, leer y eliminar objetos;
4. abrir `app_alento → alento-db → Backups`;
5. crear el backup horario;
6. ejecutar **Manual Run**;
7. revisar Backups Log;
8. comprobar que el archivo existe en el proveedor remoto;
9. repetir para el backup diario.

Un botón presionado o un job iniciado no cuentan como backup validado; debe confirmarse el archivo remoto.

## Formato

EasyPanel genera backups PostgreSQL mediante `pg_dump` y los almacena comprimidos.

La restauración nativa de EasyPanel es destructiva sobre la base destino elegida.

**Nunca probar Restore directamente sobre `alento-db`.**

## Prueba de restauración

La prueba oficial debe usar una base PostgreSQL separada.

Nombre sugerido del servicio temporal:

```text
alento-restore-test
```

Nombre de DB sugerido:

```text
alento_restore_test
```

Procedimiento:

1. tomar un backup manual reciente de producción;
2. crear un servicio PostgreSQL temporal independiente;
3. abrir sus Backups;
4. elegir Restore;
5. seleccionar el mismo Storage Provider;
6. indicar la ruta exacta del backup manual;
7. restaurar hacia la DB temporal;
8. esperar éxito completo del job;
9. comprobar schema/migraciones;
10. ejecutar la verificación de lectura del repositorio;
11. comparar datos representativos;
12. destruir el servicio temporal cuando termine la prueba.

## Verificación técnica de la copia restaurada

Desde un entorno que tenga el repositorio y apuntando `DATABASE_URL` exclusivamente a la DB restaurada:

```bash
npx prisma migrate status
npm run db:verify-restore
```

Resultado esperado de Prisma:

```text
Database schema is up to date!
```

El script `db:verify-restore` es de solo lectura y debe poder consultar correctamente modelos críticos.

Nunca ejecutar este comando con una URL escrita en documentación o Git.

## Verificación funcional mínima

Sobre la copia restaurada, confirmar como mínimo:

- existen pedidos;
- existen clientes;
- existen productos;
- pagos son consultables;
- configuración es consultable;
- usuarios son consultables;
- el último pedido puede leerse con su código/consecutivo;
- Prisma reconoce la baseline/migraciones.

No crear ni modificar datos durante esta prueba si no es necesario.

## Frecuencia de pruebas

- backup automático: horario + diario;
- revisión rápida de logs: al menos semanal;
- restauración de prueba: **mensual** y también antes/después de cambios mayores de infraestructura o PostgreSQL;
- backup manual adicional antes de una migración potencialmente destructiva.

## Incidente real

Si producción pierde datos:

1. detener o poner en mantenimiento los procesos que escriben;
2. identificar el último backup sano anterior al incidente;
3. tomar una copia de seguridad del estado actual si todavía es accesible;
4. validar con extremo cuidado servicio, DB y archivo elegido;
5. restaurar;
6. ejecutar `prisma migrate status`;
7. comprobar `/api/health`;
8. verificar pedidos, pagos, clientes y Caja;
9. reactivar escritura;
10. documentar hora del incidente, backup usado, pérdida estimada y validaciones.

## Reglas de no regresión

- nunca probar restore sobre producción;
- nunca depender solo de un backup local del mismo servidor;
- no usar copia de volumen vivo de PostgreSQL como backup de DB;
- no asumir que un backup válido porque el job empezó;
- no borrar la configuración remota sin revisar primero los archivos existentes;
- no ejecutar `migrate reset` en producción;
- mantener rutas remotas independientes para configuraciones con retención diferente.

## Criterio de cierre del hardening #5

El punto #5 solo se marca completado cuando:

- existe proveedor remoto;
- backup horario habilitado;
- backup diario habilitado;
- al menos un Manual Run terminó correctamente;
- el archivo remoto fue confirmado;
- una copia real fue restaurada en PostgreSQL temporal;
- `prisma migrate status` pasó en la copia;
- `npm run db:verify-restore` pasó en la copia;
- se documentó la fecha de la prueba;
- el usuario confirmó que el procedimiento quedó operativo.


## Evidencia de restauración — 2026-10-26

Prueba realizada contra un servicio PostgreSQL temporal independiente:

`alento-restore-test`

Origen del backup:

- proveedor: Google Drive;
- ruta diaria: `alento/production/postgres/daily`;
- archivo restaurado: `2026-10-27T01:10:10.754Z.sql.gz`.

Resultado de EasyPanel:

- Restore database: **SUCCESS**.

Validación Prisma sobre la copia restaurada:

```text
1 migration found in prisma/migrations
Database schema is up to date!
```

Validación de lectura con:

```bash
npm run db:verify-restore
```

Resultado:

```text
Database restore verification: OK
```

Conteos observados en la copia restaurada:

- customers: 435;
- users: 8;
- products: 70;
- orders: 796;
- payments: 1127;
- appSettings: 12;
- coupons: 3;
- cashSessions: 33;
- clubTransactions: 319;
- workShifts: 173.

Último pedido leído:

- id: 847;
- sequenceNumber: 797;
- source: POS;
- status: COMPLETED;
- total: 107500;
- createdAt: 2026-10-26T23:50:41.777Z.

La tabla `_prisma_migrations` fue legible y contenía la baseline `20261026190500_baseline`.

Después de completar las validaciones, el servicio temporal `alento-restore-test` fue eliminado.

Esto confirma de extremo a extremo:

```text
Producción
→ pg_dump / backup EasyPanel
→ Google Drive
→ restore en PostgreSQL temporal
→ Prisma migrate status
→ lectura real de datos
```

## Estado operativo definitivo

Configuraciones remotas activas:

### Horaria

- DB: `alento`;
- cron: `15 * * * *`;
- retención: 48;
- ruta: `alento/production/postgres/hourly`.

### Diaria

- DB: `alento`;
- cron: `30 8 * * *` en servidor UTC;
- equivale aproximadamente a 03:30 Bogotá (UTC-5);
- retención: 30;
- ruta: `alento/production/postgres/daily`.

Proveedor:

`Alentó Pizza Backups` — Google Drive.

La copia local existente puede mantenerse como redundancia rápida, pero no sustituye el backup remoto.
