# Instalación, infraestructura y recuperación de Alentó App

Última auditoría documental: 2026-11-17.
Alcance: instalación reproducible de la aplicación principal y mapa de dependencias externas conocidas. Este documento describe lo comprobado en el repositorio; no sustituye secretos, acceso a proveedores ni validación en EasyPanel.

## 1. Topología productiva conocida

Proyecto EasyPanel principal: `app_alento`.

Servicios visibles en el proyecto (confirmados por el usuario):
- `alento-app`: aplicación web/PWA.
- `alento-db`: PostgreSQL.
- `alento-notifier`: servicio independiente de notificaciones.

Aplicación:
- Repositorio: `alentopizza/alento-app` (privado), rama `main`.
- Dominio canónico: `https://alentopizza.com`.
- Puerto interno: `3000`.
- Runtime: Node.js 22.
- Next.js 15.5.24, React 19.1.9, TypeScript 5.9.2, Prisma 6.15.0.
- PostgreSQL productivo: servicio EasyPanel `alento-db`, base `alento`.
- Red interna DB documentada en `.env.example`: hostname `app_alento_alento-db`, puerto 5432, schema `public`. Confirmar el hostname real en EasyPanel antes de restaurar o conectar una VPS nueva.

El estado visual verde de EasyPanel indica que el servicio está iniciado/saludable según su indicador; no demuestra por sí solo que todas las integraciones externas funcionen.

## 2. Fuente de verdad y orden de lectura para una nueva IA

Leer antes de cualquier cambio o instalación:
1. `AGENTS.md`.
2. `README.md`.
3. Este documento.
4. `docs/HANDOFF.md`.
5. `docs/CURRENT_STATE.md`, `docs/FEATURE_INVENTORY.md` y `docs/ROADMAP.md`.
6. `docs/DEPLOYMENT.md`, `docs/CONFIGURATION.md`, `docs/OBSERVABILITY.md`.
7. `docs/PUSH_NOTIFICATIONS.md`, `docs/ALENTO_EXCLUSIVE_MODULES.md`.
8. `docs/BACKUPS_AND_RECOVERY.md`.
9. `.env.example`, `package.json`, `prisma/schema.prisma`, `prisma/migrations/`.
10. Código de las integraciones que se vayan a operar.

Si el código y un documento discrepan, el comportamiento real del código y el schema actual prevalecen; documentar la discrepancia y corregirla. No completar huecos con suposiciones.

## 3. Variables de entorno de la aplicación

El archivo de referencia completo y versionado es `.env.example`. Los valores reales deben vivir exclusivamente en EasyPanel → servicio `alento-app` → Environment. Nunca copiar valores reales a Git, documentación, capturas, tickets ni prompts.

| Variable | Uso y configuración |
|---|---|
| `DATABASE_URL` | Obligatoria. URL PostgreSQL de la base `alento`. En EasyPanel usar hostname privado del servicio DB, puerto 5432, usuario/contraseña y `?schema=public`. No usar localhost entre contenedores. |
| `NEXT_PUBLIC_APP_NAME` | Nombre visible de la aplicación; valor de referencia `Alentó POS`. |
| `NEXT_PUBLIC_APP_URL` | URL pública canónica; actualmente `https://alentopizza.com`. Debe coincidir con dominio y HTTPS reales. |
| `GOOGLE_SITE_VERIFICATION` | Token de verificación de Google Search Console; opcional. Pegar solo el token. |
| `BING_SITE_VERIFICATION` | Token de verificación de Bing; opcional. |
| `AUTH_SESSION_SECRET` | Secreto criptográfico de sesiones. Generar aleatorio, largo (mínimo 32 caracteres), único por instalación. Cambiarlo invalida sesiones existentes. |
| `AUTH_BOOTSTRAP_KEY` | Clave temporal fuerte para crear el primer ADMIN cuando no existe ningún usuario. Después del bootstrap, retirarla/rotarla según el flujo de autenticación vigente; no compartirla. |
| `MAKE_WHATSAPP_OTP_WEBHOOK_URL` | Webhook privado de Make que entrega OTP de clientes por WhatsApp. Opcional para núcleo; sin él, login OTP no funcionará. La configuración Meta/WhatsApp reside en Make, no en este repo. |
| `CUSTOMER_CREATED_WEBHOOK_URL` | Webhook privado de Make para sincronizar clientes nuevos con Google Contacts. Opcional. |
| `CHATWOOT_DASHBOARD_KEY` | Clave compartida para autenticar la Dashboard App de Chatwoot contra la API de Alentó. Debe ser idéntica en la configuración de la app de Chatwoot y en EasyPanel. |
| `NOTIFIER_WEBHOOK_URL` | URL interna/privada del endpoint de eventos del microservicio notifier. En el ejemplo de entorno termina en `/events`. Usar hostname de red privada EasyPanel cuando ambos servicios compartan proyecto/red; confirmar URL/puerto reales en el servicio notifier. |
| `NOTIFIER_SHARED_SECRET` | Secreto compartido entre Alentó App y notifier. La app envía header `x-alento-notifier-secret`. El notifier debe validar el mismo secreto. Generar un valor aleatorio fuerte y configurarlo en ambos lados. |
| `ORDER_TRACKING_SECRET` | Secreto independiente para firmar tokens/enlaces públicos de seguimiento. Generar aleatorio fuerte (mínimo 32 caracteres). No reutilizar AUTH_SESSION_SECRET ni NOTIFIER_SHARED_SECRET. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Clave Google Maps para navegador. Restringir por HTTP referrer al dominio público real y habilitar solo APIs necesarias para la UI. Es pública por diseño; nunca usarla para operaciones server-side privadas. |
| `GOOGLE_MAPS_SERVER_API_KEY` | Clave privada de servidor para Routes/Geocoding. Restringir por APIs y, si es viable en el proveedor, por IP de salida del servidor. Nunca usar prefijo NEXT_PUBLIC ni exponer en cliente. |
| `WEB_PUSH_VAPID_SUBJECT` | Identidad/contacto VAPID; ejemplo `mailto:admin@alentopizza.com`. |
| `WEB_PUSH_VAPID_PUBLIC_KEY` | Clave pública VAPID, usada por cliente para suscribirse y servidor para enviar. |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Clave privada VAPID, solo servidor. Nunca exponer al navegador ni registrar en logs. |

### Generación de secretos y claves

- Secretos genéricos: generar con un generador criptográfico del sistema, por ejemplo `openssl rand -base64 48`. Generar un valor distinto para sesión, bootstrap, seguimiento y notifier.
- VAPID: desde el repositorio ejecutar `npm run push:keys` (equivale a `web-push generate-vapid-keys`). Copiar public/private en sus variables correspondientes y conservarlas en un gestor seguro.
- No generar claves VAPID nuevas en cada redeploy. Si se cambia el par, las suscripciones existentes pueden dejar de recibir Push y los usuarios tendrán que volver a suscribirse.
- Google Maps: crear claves en Google Cloud Console, habilitar APIs que el código use, configurar facturación/cuotas y restricciones distintas para navegador y servidor.
- Make: crear/duplicar los escenarios de OTP y alta de clientes; copiar las URLs webhook de cada escenario a EasyPanel. Las credenciales de Meta y Google Contacts se configuran dentro de Make.
- Chatwoot: crear una clave aleatoria para Dashboard App y compartirla únicamente entre Chatwoot y `CHATWOOT_DASHBOARD_KEY`.

### Variables opcionales para desarrollo

`WHATSAPP_DEV_LOG_OTP=1` permite escribir OTP en logs solo en desarrollo. Nunca habilitar en producción.

El CI usa valores ficticios aislados del runner; no copiar secretos del workflow a producción.

## 4. Arranque, dependencias y despliegue de alento-app

Dependencias reproducibles:
- Usar Node 22 y npm compatible con el lockfile.
- Instalar con `npm ci`; no usar `npm install` como rutina de despliegue.
- `postinstall` ejecuta `prisma generate`.
- Scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Puerto interno 3000.
- Health check: `GET /api/health`.

Arranque vigente documentado:
```bash
prisma migrate deploy && next start -p 3000
```

Importante: el README y DEPLOYMENT deben mantenerse sincronizados. El flujo vigente es Prisma Migrate con baseline `20261026190500_baseline`; toda modificación de `prisma/schema.prisma` debe incluir una migración nueva versionada. No usar `prisma db push` como mecanismo normal de producción, ni ejecutar `migrate reset` en producción.

EasyPanel, instalación nueva:
1. Crear proyecto y red privada con nombre definido.
2. Crear PostgreSQL y base `alento`; definir usuario y contraseña fuertes.
3. Crear servicio de aplicación desde `alentopizza/alento-app`, rama `main`.
4. Configurar build con instalación limpia y build del proyecto; start según `package.json` (`npm run start`).
5. Configurar variables de entorno revisadas en la sección 3. No inventar valores de integraciones opcionales.
6. Configurar `DATABASE_URL` usando el hostname privado real que EasyPanel asignó a PostgreSQL.
7. Configurar dominio, HTTPS, puerto interno 3000 y health check `/api/health`.
8. Antes del primer arranque, confirmar que la DB destino es vacía o que se está siguiendo el procedimiento formal de restauración/baseline correcto. Nunca aplicar una baseline a ciegas sobre datos existentes.
9. Hacer deploy; revisar logs de instalación, Prisma y Next.
10. Validar health, login, creación/lectura de un pedido de prueba controlado, catálogo, permisos y módulos críticos.
11. Configurar integraciones externas una a una y validar cada una.
12. Habilitar backups remotos antes de considerar la instalación lista.

CI actual: GitHub Actions ejecuta Node 22, PostgreSQL 16 efímero, `npm ci`, validación Prisma, migraciones, drift check, lint, typecheck, tests y build. Nunca debe conectarse a producción.

## 5. PostgreSQL: datos, esquema y restauración

Servicio actual: EasyPanel `alento-db`; DB `alento`; schema `public`.

PostgreSQL guarda pedidos, pagos, devoluciones, clientes, catálogo, imágenes de productos, Caja, préstamos, nómina/turnos, Club, configuración, usuarios, auditoría, métricas, notificaciones y suscripciones Push. Por eso una restauración solo de archivos de la app no reconstruye el negocio.

El schema fuente es `prisma/schema.prisma`; migraciones activas en `prisma/migrations/`. La baseline activa es `20261026190500_baseline`. Los históricos anteriores están en `prisma/legacy-migrations/`.

Restaurar base existente:
1. Identificar el backup y su fecha.
2. Crear un PostgreSQL temporal separado en EasyPanel (nunca usar `alento-db` como entorno de prueba).
3. Restaurar el dump al servicio temporal.
4. Configurar local/runner seguro con `DATABASE_URL` apuntando exclusivamente al temporal.
5. Ejecutar `npx prisma migrate status`.
6. Ejecutar `npm run db:verify-restore`.
7. Comparar conteos y datos representativos; comprobar pedidos, pagos, PaymentRefund, clientes, productos, usuarios, AppSetting, Caja, Club, turnos, auditoría e incidentes.
8. Validar lectura funcional sin crear/modificar datos.
9. Solo después planificar la recuperación productiva con ventana de mantenimiento, backup del estado actual y aprobación del responsable.
10. Destruir el temporal al finalizar.

El script `scripts/verify-database-restore.js` es de solo lectura. Nunca ejecutar con la URL de producción durante una prueba de restauración.

## 6. Backups externos en Google Drive (EasyPanel)

Documento operativo canónico y evidencia: `docs/BACKUPS_AND_RECOVERY.md`.

Configuración verificada documentada:
- Storage Provider: `Alentó Pizza Backups` (Google Drive).
- Backup horario: cron `15 * * * *`; retención 48; ruta `alento/production/postgres/hourly`.
- Backup diario: cron `30 8 * * *` en servidor UTC (aprox. 03:30 Bogotá); retención 30; ruta `alento/production/postgres/daily`.
- Objetivo RPO: 1 hora. RTO: 2 horas.
- Restauración real validada el 2026-10-26 en PostgreSQL temporal, desde Google Drive, con `prisma migrate status` y `npm run db:verify-restore` correctos.

Para crear en otra VPS:
1. En EasyPanel → Settings → Storage Providers, conectar Google Drive con una cuenta autorizada.
2. Validar permisos de listar, escribir, leer y eliminar objetos.
3. En servicio PostgreSQL → Backups, crear tarea horaria con cron y retención anteriores, apuntando a la ruta horaria.
4. Ejecutar Manual Run y confirmar archivo remoto y log exitoso.
5. Crear una segunda tarea diaria, ruta distinta y retención independiente.
6. Ejecutar Manual Run y verificar archivo.
7. Programar revisión semanal de logs y restore de prueba mensual.
8. Nunca compartir las rutas de horario/diario porque la limpieza por retención puede borrar archivos de la otra política.
9. No usar almacenamiento local del mismo VPS como única copia.

No versionar credenciales OAuth/refresh tokens de Google Drive. La conexión al proveedor se configura desde EasyPanel.

## 7. Web Push PWA (independiente de WhatsApp/Notifier)

Web Push usa VAPID y el service worker de la PWA; no es el mismo canal que WhatsApp ni depende del microservicio notifier.

Fuente canónica: `docs/PUSH_NOTIFICATIONS.md`.

Componentes:
- Cliente: `src/lib/webPushClient.ts`.
- Endpoint único: `/api/push?scope=customer` o `/api/push?scope=staff`.
- Envío server-side: `src/lib/driverPush.ts`.
- Service worker: `public/sw.js`.
- Suscripciones: modelo Prisma `DriverPushSubscription` (el nombre es histórico; almacena Staff y clientes).
- Campañas: `src/lib/pushCampaigns.ts`, `src/components/PushCampaignManager.tsx`, `/api/push-campaigns`.
- Notificaciones transaccionales de pedidos: `src/lib/customerOrderPush.ts`.

Un mismo endpoint de suscripción no debe duplicarse. Staff y cliente son scopes separados; la sesión interna no debe usarse para inferir la audiencia. Las notificaciones transaccionales se envían solo al cliente dueño del pedido, nunca a todos los clientes.

Instalación:
1. Definir `WEB_PUSH_VAPID_SUBJECT`.
2. Generar par VAPID una sola vez con `npm run push:keys`.
3. Guardar public/private key en el gestor seguro y configurar las variables en EasyPanel.
4. Confirmar HTTPS y service worker accesible en `/sw.js`.
5. Redeploy y validar permiso/suscripción desde un navegador real.
6. Activar Push de cliente y Staff en dispositivos de prueba; enviar notificación de prueba.
7. Verificar estado en `/salud-sistema` y campañas en `/notificaciones`.
8. En migración de VPS conservar las claves VAPID para mantener las suscripciones ya guardadas en la DB.

Las campañas pueden dirigir a aplicación, sección, web o ningún destino. Las imágenes de campañas se almacenan en PostgreSQL (`NotificationImage`). Las notificaciones de estado de pedido generan tracking firmado.

## 8. Notifier / WhatsApp / Meta

Integración de Alentó App:
- Cliente HTTP: `src/lib/notifier.ts`.
- Plantillas: `src/lib/notificationTemplates.ts`, persistidas en `AppSetting` bajo `notification_templates`.
- Endpoint interno de jobs: `POST /api/internal/notification-jobs/run`.
- Autenticación de eventos: header `x-alento-notifier-secret`.
- Variables: `NOTIFIER_WEBHOOK_URL`, `NOTIFIER_SHARED_SECRET`.
- Make OTP: `MAKE_WHATSAPP_OTP_WEBHOOK_URL`.
- Jobs de reseñas Google: tabla `NotificationJob`; el endpoint requiere el mismo secreto compartido, procesa hasta 10 jobs por ejecución, reintenta con límite de 5 y usa lock para evitar concurrencia.

La app envía POST JSON al webhook notifier con evento y datos de destinatario/plantilla; timeout HTTP 10 segundos. Eventos implementados incluyen pedido creado, estados seleccionados, repartidor asignado y reseña. Si el notifier no está configurado o falla, la app registra estado/incidente; el núcleo de pedidos no debe quedar bloqueado por la integración.

IMPORTANTE: `alento-notifier` SÍ vive dentro del mismo repositorio `alentopizza/alento-app`, en `services/notifier/`. No es un repositorio Git separado. La captura de EasyPanel confirma que el servicio apunta a:
- repositorio: `alentopizza/alento-app`;
- rama: `main`;
- ruta de compilación: `/services/notifier`;
- builder: Nixpacks 1.41.0;
- comando de inicio configurado: `npm start`.

Código verificado:
- `services/notifier/package.json`: paquete privado ESM `alento-notifier`, versión 1.0.0, script `start: node server.mjs`, Node >=20.
- `services/notifier/server.mjs`: servidor HTTP nativo de Node; no usa framework externo ni base de datos propia.
- `services/notifier/README.md`: documentación de endpoints y variables.

### Variables propias del servicio alento-notifier

Configurar en EasyPanel → `app_alento` → `alento-notifier` → Entorno. Los valores secretos no deben copiarse a Git:

| Variable | Uso |
|---|---|
| `PORT` | Puerto HTTP interno. El código usa 3000 por defecto. Configurar el puerto de servicio en EasyPanel como 3000. |
| `NOTIFIER_SHARED_SECRET` | Secreto compartido con `alento-app`; debe coincidir exactamente con `NOTIFIER_SHARED_SECRET` de la aplicación. Se valida en `POST /events` y para consultar los jobs internos. |
| `CHATWOOT_BASE_URL` | URL base de Chatwoot, actualmente `https://chat.operadoranordecolombia.com`. |
| `CHATWOOT_ACCOUNT_ID` | ID numérico de la cuenta Chatwoot; README actual documenta `1`. Verificar en la instancia real. |
| `CHATWOOT_WHATSAPP_INBOX_ID` | ID del inbox de WhatsApp de Chatwoot; README actual documenta `13`. Verificar en la instancia real. |
| `CHATWOOT_API_ACCESS_TOKEN` | Token API de Chatwoot con permisos para buscar/crear contactos, consultar conversaciones/plantillas y enviar mensajes. Secreto. |
| `ALENTO_APP_BASE_URL` | URL pública de Alentó, actualmente `https://alentopizza.com`. Se usa para invocar jobs programados y convertir rutas de imágenes administradas por Alentó en URLs públicas. |

No requiere `DATABASE_URL`, Redis ni almacenamiento persistente propio. Plantillas, variables, imágenes y reglas se administran desde Alentó App y se envían en cada evento; el notifier consulta las definiciones aprobadas de plantillas en Chatwoot y mantiene una caché en memoria de 5 minutos.

### Variables adicionales observadas en el entorno EasyPanel

En la captura del entorno productivo también aparecen estas variables:

| Variable | Valor/configuración observada | Estado según el código actual |
|---|---|---|
| `CHATWOOT_ORDER_CREATED_TEMPLATE_NAME` | `nuevo_pedido_v2` | No se lee en `services/notifier/server.mjs`. |
| `CHATWOOT_ORDER_CREATED_TEMPLATE_LANGUAGE` | `es` | No se lee en `services/notifier/server.mjs`. |
| `CHATWOOT_ORDER_CREATED_TEMPLATE_CATEGORY` | `MARKETING` | No se lee en `services/notifier/server.mjs`. |
| `CHATWOOT_ORDER_CREATED_TEMPLATE_HEADER_IMAGE_URL` | URL de imagen alojada en Google Cloud Storage | No se lee en `services/notifier/server.mjs`. |

**Importante para una reinstalación:** estas cuatro variables están presentes en el entorno actual de EasyPanel, pero la versión del código inspeccionada no las consume. El flujo vigente recibe la plantilla, idioma, categoría, variables e imagen dentro del payload que envía Alentó App; la definición se administra en el módulo Notificaciones y se valida contra la plantilla sincronizada en Chatwoot. Por tanto, no depender de estas cuatro variables para reconstruir el servicio ni asumir que cambiar sus valores modifica el envío actual.

Se documentan aquí para conservar el inventario fiel del entorno productivo y facilitar una futura limpieza controlada. No eliminarlas de producción hasta comprobar en una prueba controlada que ningún flujo externo o versión desplegada las necesita. Los valores secretos siguen siendo exclusivamente los tokens y secretos; la URL de imagen no es una credencial, aunque conviene mantenerla administrada desde la configuración oficial de la app.

### Endpoints y comportamiento

- `GET /health`: responde JSON con `ok`, `service: alento-notifier` y si está habilitado el polling de jobs.
- `POST /events`: recibe evento JSON de Alentó; exige header `x-alento-notifier-secret`. Valida que exista `event` y `data.template`, resuelve contacto y conversación en el inbox configurado y envía la plantilla WhatsApp por API de Chatwoot.
- Escucha en `0.0.0.0:PORT`.
- La app principal usa `NOTIFIER_WEBHOOK_URL` apuntando a este servicio, normalmente `http://<hostname-privado-del-servicio>:3000/events`. La URL exacta debe copiarse de la red privada/hostname asignado por EasyPanel; no inventar el hostname.
- La app deriva el health probe reemplazando `/events` por `/health`.

### Scheduler de reseñas y trabajos programados

El propio proceso notifier ejecuta el scheduler, no hace falta un cron externo adicional:
- espera 15 segundos después de iniciar;
- luego hace polling cada 60 segundos;
- llama `POST {ALENTO_APP_BASE_URL}/api/internal/notification-jobs/run`;
- incluye `x-alento-notifier-secret`;
- evita polling simultáneo dentro del mismo proceso.
La app consulta hasta 10 trabajos pendientes por ejecución, aplica locks y reintentos hasta 5 veces. El job de reseña usa la configuración de plantilla persistida en Alentó App.

### Instalación en una VPS nueva

1. Crear servicio APP en EasyPanel dentro del proyecto y red privada de Alentó.
2. Fuente GitHub: `alentopizza/alento-app`, rama `main`.
3. Ruta de compilación: `/services/notifier`.
4. Builder: Nixpacks, versión 1.41.0 (según la configuración productiva mostrada).
5. Comando de instalación y build: dejar vacíos; `package.json` no declara dependencias ni scripts de build.
6. Comando de inicio: `npm start`.
7. Configurar `PORT=3000` y el resto de variables descritas arriba.
8. Configurar el puerto interno/target 3000 en EasyPanel y permitir tráfico privado desde `alento-app`.
9. En `alento-app`, configurar `NOTIFIER_WEBHOOK_URL=http://<hostname-privado>:3000/events` y el mismo `NOTIFIER_SHARED_SECRET`.
10. En Chatwoot, generar/copiar un API access token válido y confirmar Account ID e Inbox ID de WhatsApp.
11. Deploy del notifier; revisar logs para `Alento notifier listening on :3000` y `Scheduled notification polling enabled`.
12. Probar `GET /health` desde la red privada y desde el health check de la app.
13. Probar un evento controlado desde el módulo Notificaciones de Alentó App con plantilla WhatsApp aprobada y destinatario de prueba.
14. Validar contacto/conversación/mensaje en Chatwoot y confirmar entrega en WhatsApp.
15. Confirmar en `/salud-sistema` que WhatsApp / Notifier está operativo.

No agregar volúmenes ni base de datos al notifier salvo que una versión futura del código los requiera.

## 9. Chatwoot — integración Dashboard App

La app Alentó contiene:
- Página: `/integraciones/chatwoot`.
- API: `GET /api/integrations/chatwoot/customer?phone=...`.
- Autenticación: header `x-alento-chatwoot-key`, comparado en tiempo constante con `CHATWOOT_DASHBOARD_KEY`.
- Origen Chatwoot codificado en la página: `https://chat.operadoranordecolombia.com`.
- Mensaje postMessage esperado: `chatwoot-dashboard-app:fetch-info` y evento `appContext`.

La Dashboard App muestra datos del cliente, señal comercial, puntos Club, métricas, dirección/ruta y compras recientes. La clave compartida debe configurarse en EasyPanel y en el Dashboard App de Chatwoot. Restringir CORS/origen y permisos conforme a la implementación; nunca colocar la clave en URL ni en código público.

La instalación Chatwoot es un servicio externo independiente de `alento-app`. El repositorio accesible `alentopizza/chatwoot` contiene documentación de una plataforma Norde CX y no constituye evidencia suficiente para reconstruir la instancia Chatwoot de Alentó. La URL productiva observada en el código es `https://chat.operadoranordecolombia.com`; no se han verificado aquí sus servicios EasyPanel, versiones, variables, volúmenes, base Chatwoot ni Redis. Para migrar Chatwoot se requiere inventario de su stack real: Chatwoot web, Sidekiq, PostgreSQL, Redis, storage `/app/storage`, dominio/SMTP, claves secretas, credenciales Meta/WhatsApp, Facebook e Instagram, y backups de DB + almacenamiento. No reutilizar ni confundir la DB `alento` con la DB interna de Chatwoot.

## 10. Google Maps

El checkout y domicilio usan Google Places/Routes. Las dos claves cumplen funciones diferentes: navegador (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) y servidor (`GOOGLE_MAPS_SERVER_API_KEY`). Configurar APIs y facturación en Google Cloud, restricciones de referrer/IP y cuotas. Validar búsqueda de dirección, geocoding, rutas y tarifa server-side desde una compra de prueba.

## 11. Lista de validación tras migrar a otra VPS

- [ ] Repo y rama correctos; Node 22; `npm ci`.
- [ ] Servicio PostgreSQL correcto, red privada, DB `alento`.
- [ ] Restore de backup probado en DB temporal antes de recuperar producción.
- [ ] `DATABASE_URL` validada sin publicar credenciales.
- [ ] Variables requeridas y opcionales revisadas en EasyPanel.
- [ ] Secrets nuevos generados; secretos de tracking/sesión/notifier independientes.
- [ ] Dominio, HTTPS, puerto 3000 y `/api/health`.
- [ ] Prisma migrations aplicadas y status correcto.
- [ ] Login ADMIN, roles y permisos.
- [ ] POS, pedido WEB, Cocina, Caja y seguimiento.
- [ ] Google Maps Places/Routes.
- [ ] VAPID estable y Push Staff/Cliente.
- [ ] Notifier / WhatsApp / Make probado; health notifier.
- [ ] Chatwoot Dashboard App y clave compartida.
- [ ] Backups horario/diario en Google Drive con restore mensual.
- [ ] Logs, `/salud-sistema` y alertas sin errores críticos.

## 12. Datos externos que deben inventariarse antes de la migración

La configuración actual de Alentó Notifier sí está documentada en este repositorio y en `services/notifier/README.md`, incluida su ruta de monorepo, variables conocidas, puerto, endpoints y polling. La captura de EasyPanel confirma Nixpacks 1.41.0, rama `main`, ruta `/services/notifier` y `npm start`.

Siguen requiriendo inspección directa del servicio/proveedor actual:
- topología exacta de Chatwoot (servicios, versiones, DB, Redis si aplica, volúmenes/adjuntos, variables, SMTP, storage y procedimiento de backup/restauración);
- export seguro del único escenario Make y confirmación del contrato JSON/headers que recibe;
- restricciones, APIs y proyecto Google Cloud de Maps;
- credenciales OAuth del proveedor Google Drive en EasyPanel;
- hostname/usuario reales de PostgreSQL y hostnames privados que asigne EasyPanel en la nueva VPS;
- inventario final de dominios, DNS, SSL, volúmenes y recursos de los servicios actuales.

WhatsApp/Meta y las plantillas permanecen dentro de la instancia Chatwoot que se migra; no se debe crear una integración nueva. Make conserva el escenario y webhook actuales; solo se valida que el nuevo emisor mantenga el mismo contrato.

No declarar una instalación 100% replicable hasta completar esos inventarios y ejecutar una restauración integral de prueba.
