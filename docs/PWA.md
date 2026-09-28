# PWA de Alentó App

## Objetivo

Permitir que `pos.alentopizza.com` pueda instalarse como aplicación desde navegadores compatibles sin cambiar la lógica del POS ni la base de datos.

## Implementación actual

- `src/app/manifest.ts`
  - Nombre: `Alentó App`
  - Nombre corto: `Alentó`
  - `display: standalone`
  - `start_url: /`
  - colores de marca
  - iconos basados en el logo oficial suministrado por Alentó

- `src/app/layout.tsx`
  - favicon/iconos del sitio
  - referencia al manifest
  - metadata para Apple Web App
  - `themeColor`
  - registro global del service worker

- `src/components/PwaRegister.tsx`
  - registra `/sw.js`

- `public/sw.js`
  - service worker mínimo
  - toma control de la aplicación
  - elimina versiones antiguas de caché de Alentó
  - **no intercepta requests ni cachea el POS todavía**

## Por qué no se habilita caché offline todavía

El POS es una aplicación operativa con catálogo, clientes, pedidos, pagos y configuración que cambian en servidor. Una estrategia de caché genérica puede dejar una caja trabajando con precios, promociones o lógica antigua después de un despliegue.

La PWA se habilita primero como experiencia instalable/standalone. Una fase futura puede definir caché offline únicamente para recursos seguros y una política explícita de actualización.

## Icono actual

El favicon y los iconos del manifest usan:

`https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png`

Para una versión PWA final conviene almacenar copias locales optimizadas de 192x192 y 512x512 dentro de `public/`, especialmente para máxima compatibilidad con launchers móviles y modo maskable.

## Instalación esperada

Después del deploy y con HTTPS activo:

- Chrome/Edge escritorio: menú del navegador > Instalar Alentó App (cuando el navegador la considere instalable).
- Android Chrome: menú > Instalar aplicación / Añadir a pantalla principal.
- iPhone/iPad Safari: Compartir > Añadir a pantalla de inicio.

El comportamiento exacto depende del navegador y sistema operativo.

## Prisma

Este bloque no requiere cambios de Prisma ni migraciones.


## Web Push

La PWA usa el mismo motor Web Push para clientes y personal interno.

Documentación completa:

- `docs/PUSH_NOTIFICATIONS.md`

Puntos clave:

- endpoint único: `/api/push`;
- scope cliente: `?scope=customer`;
- scope interno: `?scope=staff`;
- una sola PushSubscription puede pertenecer a ambas audiencias;
- las notificaciones de pedidos se envían exclusivamente al `customerId` propietario;
- al tocar una notificación transaccional se abre el seguimiento seguro del pedido.

El sistema ya no rastrea “instalaciones PWA de clientes” como métrica de negocio. El alcance útil se mide por suscripciones Push reales desde el módulo Notificaciones.

En iPhone/iPad, Web Push requiere usar Alentó como web app añadida a la pantalla de inicio y conceder permiso desde esa instalación.
