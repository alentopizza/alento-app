# Despliegue y Prisma

Este proyecto se despliega en EasyPanel desde la rama `main` del repositorio `alentopizza/alento-app`.

## Servicio

- Proyecto EasyPanel: `app_alento`.
- Aplicación: `alento-app`.
- Puerto interno: `3000`.
- Dominio: `https://pos.alentopizza.com/`.
- Base de datos: PostgreSQL `alento-db`.

## Flujo normal de despliegue

1. Hacer cambios en el repositorio.
2. Confirmar que `main` contiene el commit esperado.
3. En EasyPanel, usar Implementar / Redeploy.
4. Nixpacks ejecuta `npm install`, `npm run build` y después `npm run start`.
5. Revisar los logs de build y runtime.
6. Validar el cambio en producción.

## Cambio de dirección Google 2026-09-23

`CustomerAddress` incorpora:

- `formattedAddress`;
- `placeId`;
- `latitude`;
- `longitude`.

Antes de probar este cambio en un despliegue existente ejecutar:

```bash
npx prisma db push
```

La lógica de aplicación utiliza una sola dirección operativa por cliente. Los registros múltiples históricos se depuran cuando el cliente actualiza/valida su dirección o genera un nuevo domicilio.

## Prisma: decisión actual

La base de datos de producción existía antes de empezar a mantener un historial formal de migraciones de Prisma. Por ello, ejecutar `prisma migrate deploy` contra esta base genera el error `P3005: The database schema is not empty`.

Hasta realizar un baseline formal, NO ejecutar `prisma migrate deploy` automáticamente al arrancar la aplicación.

### Estado real del arranque al 2026-09-22

El `package.json` vigente ejecuta:

```bash
prisma db push && next start -p 3000
```

Por tanto, cada arranque/redeploy intenta sincronizar el schema antes de iniciar Next.js.

Esto difiere de la estrategia conservadora anterior de ejecutar `db push` manualmente. No modificar silenciosamente esta decisión desde documentación ni asumir que un cambio de schema es inocuo: antes de desplegar cualquier modificación de `prisma/schema.prisma` se debe revisar el impacto porque el próximo arranque puede aplicarla automáticamente.

Sigue prohibido usar `prisma migrate deploy` hasta realizar un baseline formal.

Para ejecutar la sincronización manualmente cuando sea necesario:

```bash
npx prisma db push
```

o:

```bash
npm run prisma:push
```

Antes de cualquier `db push`, revisar siempre el cambio de schema y confirmar que no propone una operación destructiva no deseada.

## AppSetting

La configuración operativa utiliza el modelo `AppSetting`. Si una instalación existente todavía no tiene esa tabla, después de desplegar el código ejecutar:

```bash
npx prisma db push
```

La tabla almacena la configuración `pos_settings` en JSON.

## Migraciones futuras

El repositorio puede contener archivos SQL de migración como referencia, pero no deben ejecutarse automáticamente sobre la base existente hasta crear un baseline correcto.

Cuando el proyecto madure se recomienda:

1. documentar el estado actual de producción;
2. crear un baseline de Prisma;
3. marcar la migración base como aplicada;
4. usar `prisma migrate deploy` para cambios posteriores.

No hacer ese cambio de estrategia sin validar primero producción y una copia de seguridad.

## Diagnóstico rápido

### El build falla antes de arrancar

Revisar errores TypeScript/Next.js en `npm run build`.

### `number | null` al agregar productos simples al carrito

Durante el rediseño final del POS, `CatalogProduct.basePrice` sigue correctamente tipado como `number | null` porque algunos productos pueden no tener precio base directo.

Aunque `addSimpleProduct()` valida primero:

```ts
if (product.basePrice == null) return;
```

TypeScript no garantiza mantener ese narrowing dentro de un callback diferido como `setCart((current) => ...)` si dentro del callback se vuelve a acceder a `product.basePrice`.

El síntoma de build es similar a:

```text
Type 'number | null' is not assignable to type 'number'
```

La solución aprobada es capturar el valor validado antes del callback:

```ts
if (product.basePrice == null) return;
const unitPrice = product.basePrice;
```

y usar `unitPrice` al construir `CartItem`.

No resolver este caso relajando el tipo de `CartItem.unitPrice`; debe seguir siendo `number` para preservar integridad de cálculos y persistencia.

### Excepción temporal de lint del POS estructurado

Durante el refactor de integridad estructurada, `src/components/StructuredPosPage.tsx` contiene una aserción no nula posterior a una búsqueda opcional dentro del constructor de combos. ESLint 9 bloqueó el build con la regla `@typescript-eslint/no-non-null-asserted-optional-chain`.

Para recuperar el despliegue sin relajar el resto del proyecto, `eslint.config.mjs` contiene temporalmente una excepción limitada exclusivamente a:

- archivo: `src/components/StructuredPosPage.tsx`;
- regla: `@typescript-eslint/no-non-null-asserted-optional-chain`.

Esta excepción no debe ampliarse a otros archivos ni convertirse en una desactivación global. Debe retirarse cuando el constructor de combos reemplace esa aserción por validaciones explícitas de regla, tamaño, sabor y opción.

La seguridad de persistencia no depende de esta excepción: `POST /api/orders` vuelve a validar la configuración estructurada y recalcula precios contra PostgreSQL antes de crear la orden.

### El servicio construye pero se cae al arrancar

Revisar el comando `npm run start` y los logs de conexión a PostgreSQL.

### Prisma muestra P3005

Significa que se intentó aplicar migraciones a una base no vacía sin baseline. Restaurar el arranque normal y usar `prisma db push` según el flujo actual.

### La UI de Configuración falla con tabla inexistente

Ejecutar `npx prisma db push` y reiniciar el servicio si fuera necesario.


## Activación de autenticación (2026-09-20)

La primera versión de autenticación agrega tablas y enum nuevos.

Después de desplegar el código ejecutar:

```bash
npx prisma db push
```

Luego definir en EasyPanel:

```text
AUTH_SESSION_SECRET=<secreto aleatorio de al menos 32 caracteres>
AUTH_BOOTSTRAP_KEY=<clave temporal fuerte para crear el primer ADMIN>
```

Para login de clientes por WhatsApp, el código vigente delega la entrega del OTP al escenario externo de Make:

```text
MAKE_WHATSAPP_OTP_WEBHOOK_URL=...
```

La configuración Meta/WhatsApp que exista detrás de Make pertenece a la infraestructura externa de Alentó y no se guarda en este repositorio.

Para sincronizar clientes nuevos hacia Make / Google Contacts:

```text
CUSTOMER_CREATED_WEBHOOK_URL=<webhook privado de Make>
```

El webhook real debe configurarse en EasyPanel y nunca guardarse en Git.

Para notificaciones operativas opcionales:

```text
NOTIFIER_WEBHOOK_URL=...
NOTIFIER_SHARED_SECRET=...
```

Para el Dashboard App exclusivo de Chatwoot:

```text
CHATWOOT_DASHBOARD_KEY=...
```

Estas integraciones están delimitadas en `docs/ALENTO_EXCLUSIVE_MODULES.md`.

Orden recomendado de activación:

1. desplegar código;
2. ejecutar `npx prisma db push`;
3. configurar `AUTH_SESSION_SECRET`;
4. configurar `AUTH_BOOTSTRAP_KEY`;
5. reiniciar/redeploy;
6. abrir `/login`;
7. usar `Configurar primer administrador`;
8. crear el ADMIN;
9. entrar a `/usuarios` y crear colaboradores;
10. cuando WhatsApp esté listo, configurar sus variables y probar `/cuenta/login`.

Después de crear el primer ADMIN, `/setup/admin` deja de aceptar creación porque el backend exige `User.count() === 0`.

### Generación de secretos

No guardar secretos reales en Git.

Usar valores aleatorios largos. Por ejemplo, desde una terminal segura puede utilizarse un generador criptográfico del sistema.

### Desarrollo sin WhatsApp

Solo fuera de producción:

```text
WHATSAPP_DEV_LOG_OTP=1
```

Esto escribe el OTP en logs para pruebas.

Nunca habilitarlo en producción.


## Hardening previo a producción estable

La revisión vigente está en `docs/PRODUCTION_READINESS.md`.

### Riesgo actual: db push durante cada start

El comportamiento actual:

```bash
prisma db push && next start -p 3000
```

es útil durante la etapa de construcción, pero no es la estrategia recomendada para operación estable porque un reinicio/redeploy puede intentar modificar el schema.

Antes de retirar ese `db push` del arranque:

1. tomar backup/snapshot de PostgreSQL;
2. verificar que producción está sincronizada;
3. crear un baseline formal;
4. acordar la estrategia de migraciones;
5. cambiar el comando de start en un despliegue controlado.

No hacer el cambio sin estos pasos.

### Health check

EasyPanel puede usar:

`GET /api/health`

como comprobación simple de disponibilidad.

### Validación antes de cada deploy productivo

Mientras no exista CI:

```bash
npm ci
npm run lint
npm run build
```

El repositorio todavía no tiene workflow automático de CI ni suite de integración.

### Integraciones opcionales

Chatwoot, notifier/Meta y la preparación de masa no son prerrequisitos del núcleo genérico. Ver `docs/ALENTO_EXCLUSIVE_MODULES.md`.
