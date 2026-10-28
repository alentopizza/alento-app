# Observabilidad de producción — Alentó App

Última actualización: **2026-10-27**.

Estado: **IMPLEMENTADO EN REPOSITORIO — pendiente de validación productiva**.

## Objetivo

El hardening #9 cubre errores frontend/backend, logs estructurados, request IDs, alertas, monitoreo de integraciones/jobs y un health check ampliado.

## Auditoría vs. Observabilidad

- `AuditLog`: quién hizo una acción sensible, qué cambió y cuándo.
- `OperationalIncident`: qué está fallando, frecuencia, primera/última aparición y request ID.
- No usar AuditLog como almacén de errores técnicos.
- No usar OperationalIncident como historial comercial o financiero.

## Request IDs

El middleware genera un UUID nuevo por solicitud y lo propaga como `X-Request-Id` tanto hacia handlers internos como en la respuesta.

Reglas:

- no confiar en IDs enviados por el cliente;
- correlacionar UI, API, logs e incidentes con el request ID;
- guardar solo el último request ID en el incidente agregado.

## Logs estructurados

Fuente canónica: `src/lib/observability.ts`.

Funciones:

- `logInfo()`;
- `logWarning()`;
- `logError()`;
- `structuredLog()`.

Los logs propios de Alentó salen como JSON de una sola línea hacia stdout/stderr para EasyPanel.

Los eventos INFO no se guardan masivamente en PostgreSQL. Solo WARNING/ERROR operativos relevantes generan incidentes persistentes.

## Privacidad

Observabilidad reutiliza el sanitizador de datos sensibles de Auditoría.

No se guardan passwords, tokens, authorization, secrets, API keys, private keys, client secrets, hashes de idempotencia, OTP, teléfonos/direcciones ni cuerpos completos de respuestas externas.

## Incidentes agregados

Modelo: `OperationalIncident`.

Migración: `20261028001500_observability_operational_incidents`.

Campos principales:

- fingerprint;
- level;
- category;
- code;
- message;
- source;
- entityType / entityId;
- firstSeenAt / lastSeenAt;
- occurrenceCount;
- lastRequestId;
- metadata;
- resolvedAt / resolvedByUserId / resolvedByName.

Un problema repetido incrementa `occurrenceCount` en vez de crear decenas de filas. Si estaba resuelto, una nueva ocurrencia lo reabre.

## Frontend

Componentes y helpers:

- `src/components/ClientObservabilityReporter.tsx`;
- `src/lib/clientObservability.ts`;
- `src/app/error.tsx`.

Se capturan errores de navegador, promesas rechazadas y errores de render de Next.

Endpoint público controlado: `POST /api/observability/client-error`.

Protección: 20 reportes por 10 minutos por IP. No recibe stack completo ni datos del cliente.

## Backend

`src/instrumentation.ts` usa `onRequestError()` para reportar errores no controlados del servidor.

El middleware también emite log estructurado cuando falla la validación de sesión contra PostgreSQL.

## Health check

Ruta pública: `GET /api/health`.

Devuelve:

- status;
- timestamp;
- request ID;
- uptime;
- latencia total;
- estado y latencia de PostgreSQL.

Si PostgreSQL no responde, devuelve HTTP 503 sin exponer credenciales o topología interna.

## Salud del sistema

Ruta ADMIN: `/salud-sistema`.

API: `GET /api/observability/summary`.

Muestra:

- estado general;
- PostgreSQL y latencia;
- WhatsApp / Notifier;
- Web Push;
- Google Maps server-side;
- trabajos programados;
- errores y advertencias activas;
- jobs enviados/fallidos en 24 h;
- campañas Push fallidas en 24 h;
- clientes pendientes de sincronización;
- integraciones de medición configuradas;
- alertas resueltas recientemente.

La pantalla se refresca cada 60 segundos mientras la pestaña esté visible.

## Resolución de alertas

Endpoint ADMIN: `PATCH /api/observability/incidents/[id]`.

Al resolver se guarda fecha y administrador. Si la causa vuelve a ocurrir, el incidente se reabre automáticamente.

## Prueba segura

Endpoint ADMIN: `POST /api/observability/test`.

Botón visible: **Generar alerta de prueba**.

La prueba solo crea/reabre `OBSERVABILITY_TEST`; no toca pedidos, pagos, Caja ni integraciones externas.

Sirve para validar request ID, persistencia, UI y resolución extremo a extremo.

## Subsistemas monitoreados

### NotificationJob

- reintentos;
- agotamiento de 5 intentos;
- enviados como INFO;
- pendientes vencidos;
- fallidos en 24 h;
- enviados en 24 h;
- job pendiente más antiguo.

### WhatsApp / Notifier

- fallos HTTP;
- servicio no accesible;
- health remoto derivado de `NOTIFIER_WEBHOOK_URL` cambiando `/events` por `/health`;
- timeout corto para no bloquear el panel.

Si no está configurado se muestra como **No configurado** y no rompe el núcleo.

### Web Push

Comprueba que existan las tres variables VAPID. Campañas manuales reportan fallos totales o parciales.

### Google Maps

Comprueba que exista `GOOGLE_MAPS_SERVER_API_KEY`. Si falta, crea una advertencia agregada sin exponer la clave.

### Sincronización de clientes

`src/lib/customerContactWebhook.ts` registra rechazo o indisponibilidad del proveedor y el panel cuenta clientes con `contactWebhookPending = true`.

### Métricas externas

El panel muestra plataformas configuradas; las pruebas específicas continúan en `/metricas` para no hacer probes externos agresivos.

## Backups

`scripts/verify-database-restore.js` incluye `operationalIncidents` dentro de los conteos de restore.

## Pruebas automatizadas

`src/lib/observability.test.ts` valida fingerprint, sanitización, logs, persistencia, agrupación, resolución y reapertura.

Quality CI final de implementación:

- migración aplicada;
- cero drift;
- lint verde;
- TypeScript verde;
- **11 archivos / 54 tests**;
- build verde;
- run `40609801030`.

## Validación productiva pendiente

Para cerrar #9:

1. redeploy de `main`;
2. confirmar migración `20261028001500_observability_operational_incidents`;
3. confirmar Next.js `Ready`;
4. abrir `/api/health` y comprobar status/database ok, latencia y request ID;
5. abrir `/salud-sistema` como ADMIN;
6. confirmar que cargan DB, Notifier, Web Push, Google Maps y Jobs;
7. pulsar **Generar alerta de prueba**;
8. confirmar que aparece **Alerta de prueba** con categoría Sistema y diagnóstico técnico;
9. pulsar **Marcar resuelto**;
10. confirmar que sale de alertas activas y aparece en resueltas recientemente.

No provocar fallos reales en pedidos, pagos, Caja, Google Maps o WhatsApp para validar este punto.

## Reglas de no regresión

- observabilidad nunca debe romper la operación principal;
- INFO va a logs, no a PostgreSQL masivo;
- WARNING/ERROR repetidos se agrupan;
- no guardar secretos ni bodies externos completos;
- request IDs se generan server-side;
- recurrencia reabre una alerta;
- `/salud-sistema` y APIs administrativas son solo ADMIN;
- `/api/observability/client-error` permanece público únicamente con rate limiting;
- nuevas integraciones críticas deben usar `reportOperationalIncident()`.
