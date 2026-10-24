# Alentó App

Aplicación operativa propia de Alentó Pizza para centralizar punto de venta, clientes, catálogo, pedidos, cocina, pagos, caja, configuración, reparto y la experiencia pública de pedidos.

El proyecto consolida en una sola plataforma el sistema interno del restaurante y la app/web pública para clientes.

## Visión de producto

Alentó App debe funcionar desde **un solo dominio principal**.

La arquitectura objetivo es:

```text
alentopizza.com/
├── experiencia pública del cliente
├── menú
├── carrito
├── checkout
└── seguimiento del pedido

alentopizza.com/interno
├── POS protegido
├── login de empleados
├── POS
├── Pedidos
├── Cocina
├── Clientes
├── Caja
├── Menú administrativo
├── Cupones
└── Configuración
```

Alentó App está en producción. La URL pública canónica configurada en el repositorio es `https://alentopizza.com`; las superficies internas conviven por rutas y permisos dentro de la misma aplicación.

No se busca un dominio diferente para cada módulo. La separación entre experiencia pública e interna se realizará por rutas, autenticación y permisos.

## Regla obligatoria de implementación

Alentó App está en producción. Antes de crear cualquier componente, endpoint, helper, parser, validador o flujo nuevo, se debe buscar si ya existe una implementación reutilizable.

La regla del proyecto es: **misma acción o regla de negocio = misma fuente de verdad**. Las pantallas pueden cambiar presentación, permisos o contexto, pero no deben duplicar la lógica. También se debe mantener compatibilidad con datos históricos y evitar refactorizaciones masivas que pongan en riesgo la operación actual.

Las instrucciones completas para cualquier trabajo futuro están en [`AGENTS.md`](AGENTS.md). Este archivo debe revisarse antes de implementar cambios.

## Estado de desarrollo

**Punto de venta, Pedidos, Cocina, Clientes y Menú están cerrados para la etapa operativa actual.**

Estos módulos pueden recibir correcciones de bugs y ajustes menores, pero no deben reabrirse como fase de diseño salvo solicitud explícita.

La primera versión de Autenticación y Roles ya está implementada: colaboradores usan correo + contraseña y clientes disponen de acceso opcional por teléfono + OTP de WhatsApp. La app pública, checkout WEB, seguimiento, reparto GPS, Turnos/Nómina, Push y Métricas ya están implementados; continúan pendientes hardening, baseline de Prisma/CI, refund y otras mejoras estratégicas. Las integraciones de marketplace/proveedores externos no forman parte del código operativo.

La hoja de ruta vigente está en [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Estado actual

Ya están implementados, entre otros:

- POS operativo;
- Clientes como panel comercial y de historial;
- Menú administrativo con categorías y productos reordenables;
- categorías personalizadas y renombrado seguro;
- Destacados con orden independiente;
- productos simples;
- pizzas de un sabor y dos sabores;
- tamaños, bordes e ingredientes extra;
- combos configurables;
- carrito estructurado preparado para inventario/costos;
- `OrderItem.configuration` con IDs, cantidades, porciones y snapshots;
- validación y recálculo server-side de pizzas y combos;
- descuentos manuales y cupones;
- medios de pago configurables;
- creación real de pedidos en PostgreSQL;
- Cocina con preparación por cantidades;
- flujo de estados del pedido;
- dashboard de Pedidos;
- edición operativa de órdenes;
- registro y eliminación de pagos;
- pagos parciales y cuenta dividida entre varios medios;
- Caja basada en dinero realmente recibido;
- impresión térmica de 80 mm y descarga de comprobante PNG server-side;
- pedidos programados con horario de servicio y liberación a Cocina 30 minutos antes;
- reparto con disponibilidad, GPS, autoasignación, rutas múltiples, seguimiento, desempeño y cartera;
- Turnos integrados con pago de Nómina desde Caja y descuentos de préstamos;
- Centro Push con campañas manuales y métricas de entrega/apertura;
- módulo `/metricas` con analítica interna, mapa de calor día/hora, embudo, productos, fuentes de tráfico e integraciones externas guiadas;
- eliminación física controlada de pedidos y pagos;
- consecutivo comercial global independiente del `Order.id`;
- códigos visibles como `POS-0001` y, en el futuro, `WEB-0002` compartiendo la misma secuencia.

## Numeración de pedidos

El identificador comercial no depende del `Order.id` técnico.

Cada pedido nuevo recibe `Order.sequenceNumber` desde un contador global compartido entre todos los canales.

Ejemplo:

```text
POS-0001
POS-0002
WEB-0003
POS-0004
```

Ver `docs/ORDER_NUMBERING.md`.

## Checkout público y operación actual

Autenticación y Roles ya tienen una primera versión operativa y la app pública ya puede crear pedidos reales `WEB`.

El flujo público vigente incluye:

1. modalidad Recoger/Domicilio;
2. Google Places/Routes para domicilio;
3. datos del cliente o invitado;
4. recuperación segura de datos por OTP de WhatsApp;
5. forma de pago;
6. recálculo server-side;
7. creación `Order.source=WEB`;
8. seguimiento firmado.

`POST /api/orders` continúa siendo el flujo interno protegido del POS y crea `source=POS`. La web usa `/api/public-checkout`.

## Experiencia pública

La experiencia pública está operativa y continúa en mejora incremental. Incluye:

- Home principal aprobada en `/`;
- slider de acceso hacia `/menu`;
- Home móvil `1080 × 2160 px` y escritorio `1920 × 1080 px`;
- personalización desde `/personalizacion`;
- `/menu` con catálogo real y diseño responsive;
- configurador para productos simples, pizzas, dos sabores y combos;
- `/cart` con persistencia local;
- navegación Menú / Carrito / Club / Perfil;
- `/club` con reglas públicas, saldo e historial para clientes autenticados;
- `/login` unificado;
- selector de domicilio con Google Places;
- GPS opcional solo por acción del usuario;
- Google Routes y tarifa server-side;
- mapa de domicilio 3:4 con ruta y cabecera Ruta / Domicilio / Tiempo.

No debe existir un segundo sistema de pedidos. Catálogo, configuradores, precios, cobertura, normalización, consecutivo y estados deben compartirse con el sistema interno.

Las órdenes originadas por la experiencia pública ya usan `Order.source=WEB` y comparten el mismo consecutivo global con POS.

## Arquitectura técnica

- Next.js 15 + TypeScript.
- React 19.
- Tailwind CSS 4.
- PostgreSQL.
- Prisma 6.
- EasyPanel sobre VPS.
- Repositorio GitHub privado.

## Infraestructura actual

- Proyecto EasyPanel: `app_alento`.
- Servicio web: `alento-app`.
- PostgreSQL: `alento-db`.
- URL pública canónica del proyecto: `https://alentopizza.com`.
- `NEXT_PUBLIC_APP_URL` y SEO usan `https://alentopizza.com`.

Si existe un subdominio operativo adicional en EasyPanel, debe considerarse alias/entrada técnica y no reemplazar la URL canónica documentada.

## Tipos de pedido

- `DELIVERY`: Domicilio.
- `PICKUP`: Recoger en tienda.
- `STORE`: Local.

Domicilio y Recoger requieren cliente. Local permite cliente opcional.

## Integridad de producto

La configuración estructurada de los productos vendidos es una regla central del sistema.

Las órdenes nuevas de pizza/combo deben conservar IDs reales de tamaños, sabores, porciones, bordes, modificadores y componentes de combos. Esa información será la base de inventario, recetas, costos y rentabilidad.

Nunca reemplazar esta estructura por texto plano del ticket.

Ver [`docs/ORDER_DATA_INTEGRITY.md`](docs/ORDER_DATA_INTEGRITY.md).

## Pagos y Caja

Seleccionar un medio de pago al tomar la orden no significa que el dinero haya sido recibido.

El POS registra una **intención o medio previsto** mediante un `Payment PENDING`. En Pedidos, cada ingreso real genera un movimiento `Payment PAID` independiente.

Una orden puede tener varios pagos reales y varios medios de pago. Ejemplo:

```text
Pedido                 $50.000
Nequi recibido          $25.000
Efectivo recibido       $25.000
Saldo                        $0
```

Caja contabiliza únicamente movimientos realmente recibidos (`PAID`). Por ello una cuenta dividida se refleja como varios movimientos sin duplicar el total del pedido.

Los pagos creados por error pueden eliminarse físicamente y dejan de formar parte de Caja.

Ver [`docs/PAYMENTS.md`](docs/PAYMENTS.md) para la semántica completa de intención, abonos, cuenta dividida, efectivo y saldo. La documentación histórica de Caja se mantiene en [`docs/PAYMENTS_AND_CASH.md`](docs/PAYMENTS_AND_CASH.md).

## Documentación técnica

La documentación forma parte del producto y debe mantenerse junto con el código.

Si estás retomando el proyecto en otro chat/equipo, empieza por [`docs/HANDOFF.md`](docs/HANDOFF.md).

Documentos principales:

- [`docs/POS.md`](docs/POS.md): funcionamiento completo del Punto de Venta.
- [`docs/ORDERS.md`](docs/ORDERS.md): funcionamiento completo de Pedidos.
- [`docs/KITCHEN.md`](docs/KITCHEN.md): funcionamiento completo de Cocina.
- [`docs/CUSTOMERS.md`](docs/CUSTOMERS.md): funcionamiento completo de Clientes.
- [`docs/MENU.md`](docs/MENU.md): funcionamiento completo de Menú, categorías, productos, destacados y backlog futuro.
- [`docs/METRICS_AND_TRACKING.md`](docs/METRICS_AND_TRACKING.md): métricas internas, atribución y guías para conectar Meta, GA4, TikTok, Clarity, GTM y Google Ads.
- [`docs/SEO.md`](docs/SEO.md): SEO técnico/local, sitemap, datos estructurados, Search Console y operación del Perfil de Negocio.
- [`docs/ROADMAP.md`](docs/ROADMAP.md): orden de implementación por fases y criterios de cierre.
- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md): estado funcional actual.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): arquitectura y responsabilidades.
- [`docs/AUTH_ROLES_AND_PUBLIC_APP.md`](docs/AUTH_ROLES_AND_PUBLIC_APP.md): autenticación, permisos, dominio único y app pública.
- [`docs/PUBLIC_CHECKOUT_MAPS.md`](docs/PUBLIC_CHECKOUT_MAPS.md): checkout público, direcciones, Google Maps, cobertura y tarifa de domicilio.
- [`docs/ORDER_DATA_INTEGRITY.md`](docs/ORDER_DATA_INTEGRITY.md): integridad estructurada para inventario/costos.
- [`docs/ORDER_NUMBERING.md`](docs/ORDER_NUMBERING.md): consecutivo comercial global.
- [`docs/ORDERS.md`](docs/ORDERS.md): comportamiento operativo de pedidos.
- [`docs/PAYMENTS.md`](docs/PAYMENTS.md): intención de pago, abonos parciales y cuenta dividida.
- [`docs/PAYMENTS_AND_CASH.md`](docs/PAYMENTS_AND_CASH.md): pagos reales y Caja.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md): EasyPanel y Prisma.
- [`docs/HANDOFF.md`](docs/HANDOFF.md): continuidad del proyecto.

## Prisma en producción

La base de producción existía antes de un historial formal de migraciones.

Cuando un cambio modifique el schema se usa manualmente:

```bash
npx prisma db push
```

No usar `prisma migrate deploy` hasta realizar un baseline formal.

`prisma db push` no ejecuta SQL personalizado contenido únicamente en archivos de migración. La lógica operativa crítica debe vivir preferiblemente en la aplicación o documentarse con un procedimiento SQL explícito si fuera imprescindible.

## Portabilidad / producto replicable

El repositorio debe mantenerse entendible y adaptable para que pueda instalarse en otro restaurante o evolucionar a un producto comercial.

Las reglas generales deben separarse de:

- nombre y marca;
- logotipos/colores;
- catálogo;
- tarifas;
- medios de pago;
- usuarios;
- dominio;
- secretos e infraestructura de cada instalación.

Actualmente la arquitectura corresponde a una instalación por negocio. No asumir multi-tenancy hasta que exista una decisión explícita y un diseño para ello.

## Roadmap recomendado

Los cinco módulos operativos principales cerrados son POS, Pedidos, Cocina, Clientes y Menú administrativo.

Prioridades vigentes:

1. baseline formal de Prisma y retirar `db push` del arranque cuando exista un plan seguro;
2. CI automatizada con lint/build y pruebas críticas;
3. flujo auditable de refund/devoluciones;
4. completar canje transaccional de Club Alentó;
5. inventario, recetas, costos y rentabilidad;
6. hardening adicional de autenticación, auditoría y sesiones;
7. mejorar observabilidad y validación productiva continua;
8. evolución estructural de modificadores/tipos de producto cuando se apruebe;
9. parametrización/replicabilidad futura;
10. integraciones externas solo con acceso oficial, necesidad operativa y conciliación definida.

Inventario canónico de funciones y rutas: `docs/FEATURE_INVENTORY.md`.

## Rutas principales vigentes

Superficie pública:

- `/`: Home;
- `/menu`: catálogo y configurador;
- `/menu/[slug]` y `/menu/categoria/[slug]`: páginas SEO;
- `/cart`: carrito/checkout;
- `/club`: Club Alentó;
- `/login`: acceso unificado;
- `/cuenta`: perfil privado;
- `/seguimiento/[token]`: seguimiento firmado;
- `/ubicacion` y `/domicilios`: landings locales SEO.

Superficie interna:

- `/interno`: POS;
- `/interno/menu`: administración del catálogo;
- `/pedidos`;
- `/cocina`;
- `/clientes`;
- `/caja`;
- `/turnos`;
- `/cupones`;
- `/club-alento`;
- `/notificaciones`;
- `/metricas`;
- `/configuracion`;
- `/personalizacion`;
- `/usuarios`;
- `/masa` (módulo exclusivo Alentó).

Repartidor:

- `/repartidor`: home autenticada;
- `/repartidor/pedido/[token]`: detalle firmado de una entrega.

Ver `docs/FEATURE_INVENTORY.md` para el mapa completo y su documento canónico.

## Personalización pública

La experiencia pública se administra desde `/personalizacion`, solo ADMIN.

Piezas vigentes:

- Home móvil: `1080 × 2160 px`;
- Home escritorio: `1920 × 1080 px`;
- hero de `/menu`: `1920 × 730 px`;
- logo del menú: `600 × 180 px`.

La configuración vive en `AppSetting` bajo `public.home` y actualmente conserva `brand`, `landing` y `menuHero`.

Rutas de menú:

- `/menu`: menú público para clientes;
- `/interno/menu`: administración interna del catálogo.


## Operación y despliegue

Antes de un despliegue relevante o cambio de infraestructura leer:

- `docs/PRODUCTION_READINESS.md` — baseline histórico de revisión funcional y checklist; contrastar siempre con `docs/CURRENT_STATE.md`.
- `docs/ALENTO_EXCLUSIVE_MODULES.md` — límites entre el núcleo reutilizable y los módulos exclusivos de Alentó Pizza.

La operación genérica no debe depender de Chatwoot, plantillas Meta/notifier ni de la receta de masa de Alentó.
