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

## Prisma: decisión actual

La base de datos de producción existía antes de empezar a mantener un historial formal de migraciones de Prisma. Por ello, ejecutar `prisma migrate deploy` contra esta base genera el error `P3005: The database schema is not empty`.

Hasta realizar un baseline formal, NO ejecutar `prisma migrate deploy` automáticamente al arrancar la aplicación.

El script `start` debe mantenerse como:

```bash
next start -p 3000
```

Para sincronizar cambios de `prisma/schema.prisma` con la base existente, usar manualmente desde la consola del servicio:

```bash
npx prisma db push
```

o:

```bash
npm run prisma:push
```

Antes de usar `db push`, revisar siempre el cambio de schema y confirmar que no propone una operación destructiva no deseada.

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


## Integraciones marketplace

La preparación para Rappi/DiDi agrega enums y el modelo `MarketplaceOrder` a Prisma.

Después de desplegar el código que contiene este schema, ejecutar manualmente:

```bash
npx prisma db push
```

Luego reiniciar/redeployar la aplicación si Prisma Client estaba generado antes del cambio.

Las credenciales técnicas de Rappi deben configurarse como variables de entorno únicamente cuando Rappi las entregue. Nunca copiar el usuario/contraseña de Rappi Partners a estas variables.
