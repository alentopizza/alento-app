# Guía maestra de migración y reconstrucción de Alentó Pizza

Estado: **PLAN DE MIGRACIÓN PREPARADO — aún no ejecutado en una VPS nueva**.
Última revisión: 2026-11-17.
Repositorio de aplicación actual: `alentopizza/alento-app`, rama `main`.

> Objetivo: trasladar la infraestructura existente a otra VPS conservando el comportamiento, datos, dominios, integraciones y configuración actuales. No es una instalación de negocio nuevo ni una reconstrucción de WhatsApp/Make desde cero.

## 1. Decisiones de alcance confirmadas

1. Se cambia la VPS; se conservan las URL públicas y los nombres de dominio actuales.
2. Alentó App, PostgreSQL y Alentó Notifier se reconstruyen desde este monorepo y se despliegan en EasyPanel.
3. Chatwoot pertenece a otro proyecto/servicio que comparte la VPS. Se migra como una instancia existente, conservando su URL, cuenta, inbox, datos, configuración, archivos y conexión WhatsApp. No se crea una instancia Chatwoot nueva ni se vuelve a configurar Meta/WhatsApp.
4. Se conserva el mismo escenario de Make. No se crea otro escenario: el webhook existente debe seguir siendo válido siempre que el nuevo servicio envíe el mismo contrato de datos.
5. Se conservan las plantillas WhatsApp ya configuradas en Chatwoot.
6. Se conserva Google Drive como destino remoto de backups, reconectando el proveedor en la VPS nueva si las credenciales del proveedor no se pueden trasladar directamente.
7. Se conservan las claves VAPID y secretos existentes cuando se requiera mantener compatibilidad con suscripciones, sesiones y enlaces firmados. Nunca generar reemplazos por rutina.
8. El cambio DNS y la puesta en producción solo ocurren después de validar la nueva VPS y realizar el corte final de escrituras.

## 2. Topología objetivo

### Proyecto EasyPanel de Alentó

- Proyecto: `app_alento`.
- `alento-app`: Next.js/PWA, Node 22, puerto 3000, repo `alentopizza/alento-app`, rama `main`.
- `alento-db`: PostgreSQL, base `alento`, puerto interno 5432.
- `alento-notifier`: mismo repo, ruta `/services/notifier`, Nixpacks (la configuración observada es 1.41.0), puerto 3000, inicio `npm start`.

### Servicio compartido Chatwoot

- Mantener el hostname público actual: `https://chat.operadoranordecolombia.com`.
- Migrar la instancia que ya existe desde su proyecto actual; no instalar una instancia paralela como reemplazo.
- Identificar y trasladar todos sus servicios dependientes, bases de datos, Redis si aplica, volúmenes/archivos, variables y configuración de dominio/SMTP/almacenamiento que realmente use.
- Mantener Account ID `1` e Inbox WhatsApp ID `13`, sujeto a verificación después de restaurar la instancia.
- Mantener el API access token actual si continúa válido; si la migración obliga a regenerarlo, actualizarlo coordinadamente en EasyPanel de `alento-notifier` y probar.

La composición exacta de Chatwoot (servicios, versiones, Redis, almacenamiento, variables, volúmenes y comandos) debe extraerse del EasyPanel/proyecto actual antes de crear la copia. No asumir nombres de contenedores ni inventar variables.

## 3. Reglas de seguridad y continuidad

- No guardar secretos, tokens, URLs privadas de webhook ni archivos `.env` reales en GitHub.
- El inventario versionado debe contener nombres, función, servicio propietario, obligatoriedad y método de recuperación; no valores secretos.
- No ejecutar restore sobre bases productivas originales.
- No detener la VPS actual antes de validar la nueva.
- No permitir escrituras simultáneas en las dos instalaciones durante el corte.
- No cambiar el número, la cuenta ni el inbox de WhatsApp.
- No regenerar claves VAPID si se van a conservar las suscripciones Push existentes.
- No cambiar `ORDER_TRACKING_SECRET` si deben seguir funcionando enlaces de seguimiento emitidos antes del corte.
- Mantener el mismo contrato JSON y headers entre Alentó App, Notifier, Make y Chatwoot.
- Los nombres de dominio permanecen iguales; se cambia su destino DNS al final.
- En toda fase, registrar evidencia y marcarla como pendiente, ejecutada o verificada. Un servicio verde no demuestra por sí solo que la integración funcione.

## 4. Fase 0 — Inventario y preparación (antes de tocar la VPS nueva)

### 0.1 Repositorio
- Confirmar acceso al repo privado y rama `main`.
- Clonar con historial completo; no copiar solo un ZIP si se necesita conservar historial.
- Confirmar que están versionados `package-lock.json`, `prisma/schema.prisma`, `prisma/migrations/`, `services/notifier/`, `.env.example`, workflows y documentación.
- Revisar el último workflow de GitHub Actions y exigir estado verde antes del despliegue.
- Exportar o registrar los recursos de marca y archivos persistentes externos al repositorio.

### 0.2 EasyPanel actual
Guardar un inventario seguro (sin valores secretos) de:
- proyecto, servicios y nombres;
- origen Git, rama y ruta de build;
- builder y versión;
- comandos de instalación/build/inicio;
- puertos, dominios, healthchecks;
- redes internas y hostnames de servicios;
- variables por nombre y servicio;
- volúmenes/mounts;
- recursos CPU/RAM;
- tareas programadas, cron y scripts;
- políticas de reinicio y logs.

### 0.3 Secretos y proveedores
Crear un inventario privado fuera de GitHub con el nombre de cada variable, su servicio, dónde se obtiene y si debe conservarse o regenerarse. Usar un gestor de contraseñas/secretos. No pegar valores en issues, chats, commits ni capturas.

### 0.4 Chatwoot y Make
- En el proyecto EasyPanel donde vive Chatwoot, registrar la topología real y exportar sus respaldos.
- Confirmar qué DB usa Chatwoot, versión, Redis (si existe), almacenamiento de adjuntos y volúmenes.
- Registrar configuración de dominio, SSL, SMTP y almacenamiento.
- Exportar/respaldar el estado de la instancia según el método soportado por su versión.
- Documentar el escenario único de Make: nombre, módulos, URL webhook, payload esperado, headers, autenticación y respuesta. No duplicar ni recrear.
- Verificar que el escenario no dependa de una IP de la VPS antigua.

## 5. Fase 1 — Crear el nuevo repositorio GitHub

Esta fase ocurre antes de conectar EasyPanel a la nueva fuente.

1. Crear un repositorio privado nuevo en la organización/cuenta GitHub destino.
2. Confirmar nombre, propietario y permisos de acceso del equipo.
3. Desde un entorno seguro, clonar el repositorio actual conservando todo el historial:

```bash
git clone --mirror git@github.com:alentopizza/alento-app.git
cd alento-app.git
git push --mirror git@github.com:<ORGANIZACION_DESTINO>/<REPOSITORIO_DESTINO>.git
```

4. Verificar ramas, tags, historial y último commit en el destino.
5. Configurar reglas de rama principal, protección de `main`, pull requests y permisos equivalentes.
6. Confirmar que GitHub Actions y sus workflows se copiaron; ejecutar Quality CI en el repositorio nuevo.
7. Configurar los secretos/variables de GitHub Actions que realmente requieran los workflows. No copiar secretos de EasyPanel a GitHub Actions si el workflow no los necesita.
8. Mantener el repositorio original intacto como rollback; no archivarlo ni borrarlo durante la migración.
9. Registrar la URL Git destino y el commit exacto que se va a desplegar.

No copiar `.env`, dumps, tokens, claves privadas, credenciales OAuth ni backups al repositorio. Los recursos binarios externos al Git deben inventariarse y trasladarse por su mecanismo seguro.

## 6. Fase 2 — Crear la nueva VPS y EasyPanel

1. Crear VPS con capacidad igual o superior a la actual, espacio suficiente para DB, Chatwoot, adjuntos y backups temporales.
2. Instalar EasyPanel y asegurar acceso administrativo.
3. Configurar firewall, SSH, actualizaciones, zona horaria y monitoreo.
4. Crear el proyecto EasyPanel `app_alento`.
5. Crear redes/servicios con nombres previstos; confirmar DNS interno real que EasyPanel asigne.
6. No cambiar DNS público todavía.
7. Mantener la VPS anterior encendida y disponible para rollback.

## 6. Fase 2 — Restaurar PostgreSQL de Alentó

La política existente está documentada en `docs/BACKUPS_AND_RECOVERY.md`.

Configuración conocida:
- Servicio: `alento-db`.
- Base: `alento`.
- Puerto: 5432.
- Backup horario: cron `15 * * * *`, retención 48, ruta `alento/production/postgres/hourly`.
- Backup diario: cron `30 8 * * *` en servidor UTC (aprox. 03:30 Bogotá), retención 30, ruta `alento/production/postgres/daily`.
- Proveedor registrado: `Alentó Pizza Backups` — Google Drive.

Pasos:
1. Crear PostgreSQL compatible con la versión real del origen. La versión productiva debe confirmarse en EasyPanel antes de crear el destino.
2. Conectar/restablecer el proveedor Google Drive en EasyPanel nuevo.
3. Restaurar primero un backup en una DB temporal y ejecutar `npx prisma migrate status` y `npm run db:verify-restore`.
4. Verificar pedidos, clientes, productos, pagos, devoluciones, usuarios, caja, consecutivos, configuración, imágenes y suscripciones Push.
5. Para el corte final, detener escrituras de la app antigua y generar un backup final reciente.
6. Restaurar el backup final en la DB definitiva nueva.
7. Registrar hora, archivo y resultado. No continuar si faltan tablas o datos críticos.

No ejecutar `prisma migrate reset`, `db push` ni Restore sobre la base original.

## 7. Fase 3 — Desplegar Alentó App

### Configuración EasyPanel observada
- Proyecto: `app_alento`.
- Repo: `alentopizza/alento-app`.
- Rama: `main`.
- Node: 22.
- Puerto: 3000.
- Health check: `GET /api/health`.
- Arranque documentado: `prisma migrate deploy && next start -p 3000`.

### Variables
Usar `.env.example` y `docs/INSTALLATION_AND_RECOVERY.md` como inventario técnico. Copiar los valores reales desde el gestor privado/EasyPanel actual. Como mínimo revisar:
- `DATABASE_URL`;
- `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`;
- `AUTH_SESSION_SECRET`, `AUTH_BOOTSTRAP_KEY` (no repetir bootstrap si ya hay usuarios);
- `MAKE_WHATSAPP_OTP_WEBHOOK_URL`;
- `CUSTOMER_CREATED_WEBHOOK_URL`;
- `CHATWOOT_DASHBOARD_KEY`;
- `NOTIFIER_WEBHOOK_URL`, `NOTIFIER_SHARED_SECRET`;
- `ORDER_TRACKING_SECRET`;
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_SERVER_API_KEY`;
- `WEB_PUSH_VAPID_SUBJECT`, `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`;
- cualquier variable adicional presente en el `.env.example` vigente.

Procedimiento:
1. Conectar repo privado y rama `main`.
2. Configurar Node 22 y comandos según el servicio productivo vigente.
3. Configurar variables con secretos originales y la nueva URL privada de PostgreSQL.
4. Confirmar que el hostname DB es el que EasyPanel asignó, no copiarlo a ciegas.
5. Implementar y revisar logs de build/start.
6. Confirmar migraciones sin cambios destructivos y `GET /api/health`.
7. No crear otro administrador ni ejecutar bootstrap: se restaura la base con usuarios existentes.

## 8. Fase 4 — Desplegar Alentó Notifier

Código:
- Repo: `alentopizza/alento-app`.
- Rama: `main`.
- Ruta de build: `/services/notifier`.
- Nixpacks 1.41.0 (captura productiva).
- Inicio: `npm start`.
- Puerto: 3000.
- Endpoint: `GET /health`, `POST /events`.
- Polling de jobs: inicia 15 segundos después del arranque y consulta cada 60 segundos a Alentó App.

Variables observadas en EasyPanel:
- `PORT=3000`;
- `NOTIFIER_SHARED_SECRET`;
- `CHATWOOT_BASE_URL=https://chat.operadoranordecolombia.com`;
- `CHATWOOT_ACCOUNT_ID=1`;
- `CHATWOOT_WHATSAPP_INBOX_ID=13`;
- `CHATWOOT_API_ACCESS_TOKEN`;
- `ALENTO_APP_BASE_URL=https://alentopizza.com`.

Variables heredadas observadas pero no leídas por el `server.mjs` actual:
- `CHATWOOT_ORDER_CREATED_TEMPLATE_NAME`;
- `CHATWOOT_ORDER_CREATED_TEMPLATE_LANGUAGE`;
- `CHATWOOT_ORDER_CREATED_TEMPLATE_CATEGORY`;
- `CHATWOOT_ORDER_CREATED_TEMPLATE_HEADER_IMAGE_URL`.

No tratarlas como necesarias para el flujo actual. No borrarlas del servicio viejo antes del corte; mantener el inventario para limpieza posterior.

Pasos:
1. Crear servicio APP en el proyecto `app_alento`.
2. Configurar fuente GitHub, rama y ruta exactas.
3. Configurar Nixpacks y `npm start`.
4. Copiar variables actuales, conservando `NOTIFIER_SHARED_SECRET` idéntico al de Alentó App.
5. Configurar tráfico privado desde la app al notifier.
6. En Alentó App, usar `NOTIFIER_WEBHOOK_URL` con el hostname privado nuevo y ruta `/events`.
7. Probar `GET /health`.
8. Probar un evento controlado y validar contacto, conversación, plantilla y mensaje en la instancia Chatwoot migrada.
9. Confirmar polling programado y revisar logs.

El notifier no tiene DB propia ni requiere volumen persistente según el código actual.

## 9. Fase 5 — Migrar Chatwoot existente

Chatwoot es un servicio de otro proyecto que comparte la VPS. Debe trasladarse como instancia existente, no recrearse desde cero.

1. Inventariar primero su EasyPanel actual: servicio web, workers, DB, Redis, volúmenes, storage, versiones, comandos y todas las variables.
2. Tomar backup consistente de su PostgreSQL y respaldar Redis/estado auxiliar si la versión y configuración lo requieren.
3. Respaldar adjuntos, archivos y cualquier volumen persistente; un dump SQL por sí solo puede no incluirlos.
4. Registrar configuración de dominio `chat.operadoranordecolombia.com`, SSL, SMTP, almacenamiento y secretos.
5. Desplegar en la VPS nueva las mismas versiones y topología compatible.
6. Restaurar DB y archivos siguiendo el procedimiento recomendado para la versión exacta de Chatwoot.
7. Mantener la misma URL pública; actualizar DNS solo en el corte.
8. Validar acceso administrativo, Account ID 1, Inbox WhatsApp 13, contactos, conversaciones, adjuntos, plantillas sincronizadas y conexión existente de WhatsApp.
9. No volver a vincular Meta ni cambiar el número. Si Chatwoot exige reautenticación tras la restauración, detener el corte y resolver con el administrador de la instancia.
10. Confirmar API access token o reemplazarlo solo si dejó de ser válido, actualizando el notifier de forma coordinada.

**Pendiente de completar con evidencia del proyecto Chatwoot actual:** nombres de servicios, versiones, variables, volúmenes, Redis, DB y comandos reales. No hay datos suficientes en el repositorio Alentó para inventariarlos.

## 10. Fase 6 — Mantener Make y las integraciones

No crear escenarios nuevos.

1. Mantener el escenario único y su webhook actual.
2. Confirmar que las variables de Alentó App apuntan al mismo webhook vigente.
3. Comparar payload de prueba antiguo y nuevo (método, headers, JSON, nombres/tipos de campos).
4. Probar OTP WhatsApp y sincronización de clientes si ambas funciones están activas.
5. No modificar el escenario si el contrato recibido es idéntico.
6. Verificar que Google Maps conserva claves y restricciones válidas para el dominio.
7. Verificar que Google Drive puede listar, escribir, leer y eliminar backups desde la VPS nueva.

La conexión WhatsApp/Meta vive en Chatwoot o en la configuración externa existente; esta migración no debe recrear dicha conexión.

## 11. Fase 7 — Validación integral antes del corte

### Infraestructura
- Todos los servicios tienen logs limpios y healthchecks correctos.
- PostgreSQL acepta conexiones solo desde redes autorizadas.
- App se conecta a la DB restaurada.
- Notifier accede a Chatwoot por la URL conservada.
- Chatwoot conserva DB, Redis/estado, archivos y dominio.
- Backups remotos escriben y se pueden leer.

### Aplicación
- Login de empleados y permisos.
- Menú público, carrito y checkout.
- Crear pedido WEB y POS.
- Pedido programado.
- Cocina y cambios de estado.
- Pagos, caja y devoluciones.
- Clientes, catálogo e imágenes.
- Reparto y seguimiento firmado.
- Push staff y cliente usando las suscripciones restauradas.
- Métricas y salud del sistema.

### Integraciones
- Make: ejecutar prueba real con payload equivalente.
- Notifier: evento de prueba hacia Chatwoot.
- Chatwoot: consultar contacto/conversación y enviar plantilla aprobada de prueba.
- WhatsApp: confirmar entrega sin volver a vincular Meta.
- Maps: geocodificación/ruta y cálculo de domicilio.
- Google Drive: backup manual de prueba.

No marcar una fase como verificada solo porque el contenedor esté iniciado.

## 12. Fase 8 — Corte definitivo

1. Elegir ventana de bajo tráfico.
2. Comunicar congelamiento operativo.
3. Poner la app anterior en mantenimiento o detener temporalmente escrituras.
4. Detener los schedulers/consumidores que puedan procesar trabajos duplicados.
5. Generar backup final de PostgreSQL Alentó y Chatwoot; respaldar cambios de archivos desde el último backup.
6. Restaurar/replicar los últimos datos en la nueva VPS.
7. Confirmar que no hay escrituras en la instancia antigua.
8. Cambiar DNS de `alentopizza.com` y `chat.operadoranordecolombia.com` a la nueva VPS, conservando los mismos hostnames.
9. Emitir/validar SSL en EasyPanel.
10. Activar app, notifier y Chatwoot en la nueva VPS.
11. Verificar health, pedidos, pagos, notificaciones y WhatsApp.
12. Mantener la VPS antigua apagada para escrituras pero disponible para rollback durante el periodo acordado.

### Rollback
Si falla una prueba crítica:
- no habilitar escrituras en ambas VPS;
- devolver DNS al origen anterior;
- reactivar servicios antiguos;
- identificar si hubo escrituras en la nueva base;
- reconciliar datos antes de reabrir operación;
- registrar incidente y causa.

## 13. Fase 9 — Cierre y operación posterior

- Ejecutar backup remoto desde la nueva VPS y confirmar archivo en Google Drive.
- Ejecutar una restauración de prueba en DB temporal.
- Confirmar notificaciones programadas y logs del notifier.
- Revisar SSL, DNS, uptime y alertas.
- Actualizar documentación con versiones, fechas, endpoints, recursos y resultados reales.
- Retirar la VPS antigua solo después del periodo de observación y autorización explícita.

## 14. Registro de ejecución

Mantener este checklist actualizado. El estado inicial de todas las fases es **PENDIENTE** hasta que exista evidencia.

| Fase | Estado inicial | Evidencia requerida |
|---|---|---|
| 0. Inventario | PENDIENTE | Inventario sin secretos, export de configuración y accesos comprobados |
| 1. VPS/EasyPanel | PENDIENTE | VPS creada, seguridad y proyecto listos |
| 2. PostgreSQL Alentó | PENDIENTE | Restore temporal y final verificados |
| 3. Alentó App | PENDIENTE | Build, migraciones, health y pruebas |
| 4. Notifier | PENDIENTE | Health, evento real y polling |
| 5. Chatwoot | PENDIENTE | DB/archivos restaurados, cuenta/inbox/WhatsApp validados |
| 6. Make/integraciones | PENDIENTE | Payload equivalente y webhook existente validado |
| 7. QA integral | PENDIENTE | Checklist funcional firmado |
| 8. Corte DNS | PENDIENTE | DNS/SSL y smoke tests correctos |
| 9. Cierre | PENDIENTE | Backup nuevo, restore test y documentación final |

## 15. Orden de lectura para ejecutar la migración

1. `AGENTS.md` — reglas obligatorias del proyecto.
2. `README.md` — visión, arquitectura y estado funcional.
3. Este documento — secuencia maestra y alcance.
4. `docs/INSTALLATION_AND_RECOVERY.md` — variables, servicios y recuperación técnica.
5. `docs/BACKUPS_AND_RECOVERY.md` — backups/restauración de Alentó DB.
6. `docs/DEPLOYMENT.md` — Prisma y despliegue.
7. `docs/CONFIGURATION.md` — configuración de negocio.
8. `docs/PUSH_NOTIFICATIONS.md` — Push y VAPID.
9. `services/notifier/README.md` — Notifier/Chatwoot.
10. `.env.example` — nombres de variables de Alentó App.
11. `prisma/schema.prisma` y `prisma/migrations/` — estructura de datos.

## 16. Criterio de éxito

La migración solo se considera completada cuando:
- la nueva VPS opera con las mismas URL y comportamiento;
- la DB Alentó conserva datos y relaciones;
- Chatwoot conserva su instancia, historial, archivos, cuenta, inbox y conexión WhatsApp;
- Make sigue usando el mismo escenario/webhook con el mismo contrato;
- Notifier envía y procesa jobs;
- Push existente sigue funcionando;
- Google Maps y Google Drive están operativos;
- backups externos y restauración de prueba pasan;
- no existen escrituras divididas entre VPS;
- la documentación registra lo realmente ejecutado.

**Importante:** este manual prepara el orden y las verificaciones; no significa que la nueva VPS ya esté instalada ni que los datos/secretos externos hayan sido exportados. La migración comienza cuando el usuario indique la nueva VPS y autorice iniciar la Fase 0.
