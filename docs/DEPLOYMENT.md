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

## Prisma: decisión actual

La base de datos de producción existía antes de empezar a mantener un historial formal de migraciones de Prisma. Por ello, ejecutar `prisma migrate deploy` contra esta base genera el error `P3005: The database schema is not empty`.

Hasta realizar un baseline formal, NO ejecutar `prisma migrate deploy` automáticamente al arrancar la aplicación.

### Estado real del arranque al 2026-10-26

El `package.json` vigente ejecuta:

```bash
prisma db push && next start -p 3000
```

Los backfills históricos de ganancias de repartidores e IngredientGroup fueron retirados del arranque después de quedar aplicados.

Por tanto, cada arranque/redeploy intenta sincronizar el schema antes de iniciar Next.js, pero ya no ejecuta reparaciones de datos de una sola vez.

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

La configuración operativa utiliza el modelo `AppSetting`. El arranque vigente sincroniza esta tabla mediante `prisma db push` antes de iniciar Next.js. La tabla almacena la configuración `pos_settings` en JSON.

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
npx prisma db push --skip-generate   # solo sobre DB efímera del runner
npm run lint
npm run typecheck
npm test
npm run build
```

Un fallo en cualquiera de estos pasos deja el workflow rojo.

La suite automatizada actual usa Vitest y contiene 31 pruebas críticas en 5 archivos. No necesita credenciales productivas ni servicios externos.

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
- la creación de la tabla es aditiva, pero como el arranque ejecuta `prisma db push`, revisar el diff de schema antes del primer redeploy que incluya esta función.

Este almacenamiento es apropiado para el catálogo actual de Alentó. Si el volumen de imágenes creciera de forma significativa, evaluar object storage dedicado sin cambiar la semántica de `Product.imageUrl`.



## Cupones por canal — 2026-10-26

El modelo `Coupon` incorpora campos aditivos:

- `visibleInPos Boolean @default(true)`;
- `visibleInCart Boolean @default(false)`.

El siguiente redeploy que contenga este schema puede añadirlos mediante el `prisma db push` del arranque.

La elección de defaults es deliberada:

- cupones existentes siguen disponibles en POS;
- ningún cupón histórico se publica automáticamente en la app del cliente.

No ejecutar scripts de migración manuales para estos campos salvo diagnóstico explícito.

Documento funcional: `docs/COUPONS.md`.

## Diagnóstico de logs de arranque

Durante un redeploy puede aparecer un `SIGTERM` correspondiente al proceso anterior que EasyPanel está deteniendo. Si a continuación Next.js inicia y muestra `Ready`, ese `SIGTERM` por sí solo no indica una caída permanente.

La advertencia Node `DEP0169` sobre `url.parse()` proviene actualmente de una dependencia; no se ha encontrado uso directo de `url.parse()` en el código de Alentó. Tratarla como advertencia deprecada mientras el servidor continúe iniciando correctamente, y revisar dependencias cuando corresponda.
