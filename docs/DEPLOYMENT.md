# Despliegue y Prisma

Este proyecto se despliega en EasyPanel desde la rama `main` del repositorio `alentopizza/alento-app`.

## Servicio

- Proyecto EasyPanel: `app_alento`.
- Aplicación: `alento-app`.
- Puerto interno: `3000`.
- URL pública canónica: `https://alentopizza.com/`.
- Base de datos: PostgreSQL `alento-db`.

## Flujo normal de despliegue

1. Hacer cambios en el repositorio.
2. Confirmar que `main` contiene el commit esperado.
3. En EasyPanel, usar Implementar / Redeploy.
4. El build instala dependencias/genera Prisma y ejecuta `npm run build`; el arranque usa `npm run start`.
5. Revisar los logs de build y runtime.
6. Validar el cambio en producción.

## Cambio de dirección Google 2026-09-23

`CustomerAddress` incorpora:

- `formattedAddress`;
- `placeId`;
- `latitude`;
- `longitude`.

Nota histórica: este cambio requería sincronizar Prisma. En el despliegue vigente esa sincronización ocurre automáticamente dentro de `npm run start`; revisar el impacto del schema antes de redeploy.

La lógica de aplicación utiliza una sola dirección operativa por cliente. Los registros múltiples históricos se depuran cuando el cliente actualiza/valida su dirección o genera un nuevo domicilio.

## ProductType PIZZA_CUSTOM — 2026-10-25

El producto **Arma Tu Pizza** introduce el valor `PIZZA_CUSTOM` en el enum Prisma `ProductType`.

El cambio es aditivo: no elimina ni renombra valores existentes. En el primer redeploy que incluya esta función, el `prisma db push` del arranque debe incorporar el nuevo valor antes de iniciar Next.js.

Después del deploy validar:

1. que los logs de `prisma db push` terminen correctamente;
2. abrir `/interno/menu`;
3. editar **Arma Tu Pizza**;
4. cambiar su tipo de **Pizza de sabor** a **Arma Tu Pizza**;
5. guardar el tipo; Arma Tu Pizza toma los precios directamente de los ingredientes;
6. verificar que las cuatro subcategorías base aparezcan en Ingredientes;
7. probar una pizza completa y una mitad y mitad tanto en POS como en `/menu`.

No actualizar el registro directamente por nombre en SQL como parte del deploy: la conversión del producto existente se realiza desde el administrador para que sea explícita y auditable a nivel operativo.

## IngredientGroup — 2026-10-25

El despliegue de `PIZZA_CUSTOM` incorporó el modelo `IngredientGroup` y `Product.ingredientGroupId`.

El backfill histórico vive en:

`scripts/backfill-ingredient-groups.js`

Su primera ejecución:

- creó Carnes y Embutidos;
- creó Verduras, Vegetales y Legumbres;
- creó Frutas;
- creó Otros;
- clasificó por nombre únicamente ingredientes sin grupo;
- registró `catalog.ingredientGroupsBackfilledV1` en `AppSetting`.

El backfill ya fue aplicado en producción y **ya no forma parte del comando normal de arranque**. Se conserva únicamente como herramienta histórica/manual.

La misma regla aplica a `scripts/backfill-driver-earnings.js`: no debe ejecutarse en cada reinicio del servicio.

## Prisma: baseline formal implementada

La base de producción nació antes de un historial formal de Prisma Migrate. El repositorio ya corrigió esa deuda en código mediante una baseline completa:

`prisma/migrations/20261026190500_baseline/migration.sql`

Las 23 migraciones previas se conservan como historial técnico en:

`prisma/legacy-migrations/`

La baseline fue generada desde una base vacía hacia el schema actual, aplicada sobre PostgreSQL 16 temporal y validada con cero drift. Quality CI ya usa `prisma migrate deploy` sobre una base efímera.

Producción ya validó y registró la baseline:

- drift check: **No difference detected**;
- `prisma migrate resolve --applied 20261026190500_baseline`: correcto;
- `prisma migrate status`: **Database schema is up to date!**;
- `prisma migrate deploy`: **No pending migrations to apply.**

El arranque oficial del repositorio es ahora:

```bash
prisma migrate deploy && next start -p 3000
```

`prisma db push` deja de ser el mecanismo normal de producción. Puede conservarse como utilidad manual de desarrollo/diagnóstico, pero no debe formar parte del start ni sustituir una migración versionada.

## AppSetting

La configuración operativa utiliza el modelo `AppSetting`. Su schema se mantiene mediante migraciones Prisma versionadas. La tabla almacena la configuración `pos_settings` en JSON.

## Migraciones futuras

La baseline ya está formalizada. A partir de ahora:

1. todo cambio de `prisma/schema.prisma` debe incluir una migración nueva en `prisma/migrations`;
2. Quality CI aplica todas las migraciones sobre PostgreSQL vacío y verifica cero drift;
3. producción ejecuta `prisma migrate deploy` durante el arranque;
4. no volver a introducir cambios de schema únicamente mediante `db push`.

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

Revisar primero los logs del `prisma db push` que ejecuta `npm run start`. Solo usar una sincronización manual como diagnóstico controlado después de revisar el impacto del schema.


## Activación de autenticación (2026-09-20)

La primera versión de autenticación agrega tablas y enum nuevos.

El schema se sincroniza al arrancar mediante `npm run start`. Antes del redeploy revisar el cambio de Prisma y luego definir en EasyPanel:

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

1. revisar el diff de `prisma/schema.prisma`;
2. configurar `AUTH_SESSION_SECRET` y `AUTH_BOOTSTRAP_KEY` si la instalación aún no los tiene;
3. desplegar/redeploy — `npm run start` ejecutará la sincronización de Prisma;
4. revisar logs de arranque;
5. abrir `/login`;
6. en una instalación nueva, usar `Configurar primer administrador`;
7. crear colaboradores desde `/usuarios`;
8. cuando WhatsApp esté listo, configurar sus variables y probar el login de cliente desde `/login`.

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

`docs/PRODUCTION_READINESS.md` es el baseline histórico de salida. Para el estado vigente consultar `docs/CURRENT_STATE.md` y `docs/FEATURE_INVENTORY.md`.

### Estrategia de schema vigente

El arranque usa:

```bash
prisma migrate deploy && next start -p 3000
```

La baseline está aplicada en producción y el historial activo parte de `20261026190500_baseline`.

### Health check

EasyPanel puede usar:

`GET /api/health`

como comprobación de disponibilidad.

Desde el hardening #9 devuelve además:

- request ID;
- uptime;
- latencia total;
- estado y latencia de PostgreSQL;
- HTTP 503 si la base no responde.

La ruta no expone secretos ni topología interna.

La vista ADMIN completa vive en:

`/salud-sistema`

Documento canónico: `docs/OBSERVABILITY.md`.

### Instalación reproducible de dependencias

El repositorio versiona `package-lock.json` (lockfile v3).

Para instalaciones limpias y builds productivos usar:

```bash
npm ci
```

`npm ci` instala exactamente las versiones registradas en el lockfile y falla si `package.json` y `package-lock.json` quedan desalineados.

Reglas:

- no borrar `package-lock.json` durante un refactor;
- no regenerarlo sin revisar el diff;
- cualquier cambio de dependencias debe versionar `package.json` y `package-lock.json` juntos;
- no usar `npm install` como rutina de despliegue;
- el lockfile vigente fue validado desde un runner limpio con Node 22 y npm 10, incluyendo `postinstall -> prisma generate`.

### Validación automatizada antes de despliegues

El repositorio dispone de `.github/workflows/quality-ci.yml`.

Se ejecuta automáticamente en cada push a `main`, en pull requests y también permite ejecución manual.

El job usa Node 22 y crea PostgreSQL 16 efímero. Nunca debe usar `DATABASE_URL` de producción.

Secuencia vigente:

```text
npm ci
npx prisma validate
npx prisma migrate deploy            # solo sobre DB efímera del runner
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
npm run lint
npm run typecheck
npm test
npm run build
```

Un fallo en cualquiera de estos pasos deja el workflow rojo.

La suite automatizada actual usa Vitest y contiene 54 pruebas en 11 archivos, incluidas pruebas persistentes de auditoría y observabilidad. No necesita credenciales productivas ni servicios externos.

Las pruebas E2E de navegador siguen pendientes y deben agregarse como una fase futura separada.

### Integraciones opcionales

Chatwoot, notifier/Meta y la preparación de masa no son prerrequisitos del núcleo genérico. Ver `docs/ALENTO_EXCLUSIVE_MODULES.md`.

## Imágenes persistentes de producto

El catálogo puede guardar imágenes oficiales en PostgreSQL mediante el modelo `ProductImage`.

Características:

- no requiere volumen local del contenedor;
- no depende de Glide ni de una URL externa una vez cargada;
- los binarios sobreviven redeploys porque viven en la base de datos;
- `sharp` normaliza cada carga a WebP, máximo 1600 × 1600 y calidad 84 antes de persistir;
- el endpoint público `/api/product-images/[id]` sirve la imagen con cache inmutable;
- la escritura/eliminación exige sesión ADMIN dentro de la propia ruta;
- la creación de la tabla es aditiva, pero como el arranque ejecuta `prisma migrate deploy`, revisar el diff de schema antes del primer redeploy que incluya esta función.

Este almacenamiento es apropiado para el catálogo actual de Alentó. Si el volumen de imágenes creciera de forma significativa, evaluar object storage dedicado sin cambiar la semántica de `Product.imageUrl`.



## Cupones por canal — 2026-10-26

El modelo `Coupon` incorpora campos aditivos:

- `visibleInPos Boolean @default(true)`;
- `visibleInCart Boolean @default(false)`.

El siguiente redeploy que contenga este schema puede añadirlos mediante una migración Prisma versionada.

La elección de defaults es deliberada:

- cupones existentes siguen disponibles en POS;
- ningún cupón histórico se publica automáticamente en la app del cliente.

No ejecutar scripts de migración manuales para estos campos salvo diagnóstico explícito.

Documento funcional: `docs/COUPONS.md`.

## Diagnóstico de logs de arranque

Durante un redeploy puede aparecer un `SIGTERM` correspondiente al proceso anterior que EasyPanel está deteniendo. Si a continuación Next.js inicia y muestra `Ready`, ese `SIGTERM` por sí solo no indica una caída permanente.

La advertencia Node `DEP0169` sobre `url.parse()` proviene actualmente de una dependencia; no se ha encontrado uso directo de `url.parse()` en el código de Alentó. Tratarla como advertencia deprecada mientras el servidor continúe iniciando correctamente, y revisar dependencias cuando corresponda.


## Migración de Observabilidad — 2026-10-27

El hardening #9 añade el modelo:

`OperationalIncident`

Migración versionada:

`20261028001500_observability_operational_incidents`

El redeploy normal debe aplicarla automáticamente mediante:

```bash
prisma migrate deploy && next start -p 3000
```

No ejecutar `db push` manual para este cambio.

Después del primer deploy validar:

1. migración aplicada correctamente;
2. Next.js `Ready`;
3. `GET /api/health` responde `status: ok`;
4. entrar como ADMIN a `/salud-sistema`;
5. generar una alerta de prueba;
6. verla activa;
7. marcarla resuelta.

No se requieren variables de entorno nuevas para Observabilidad.

Las integraciones existentes se detectan usando sus variables actuales; no se imprimen secretos.
