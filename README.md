# Alentó App

Aplicación operativa propia de Alentó Pizza para centralizar punto de venta, clientes, catálogo, pedidos, cocina, pagos, caja, configuración y la futura experiencia pública de pedidos.

El proyecto busca reemplazar gradualmente Glide y consolidar en una sola plataforma el sistema interno del restaurante y, más adelante, la app/web pública para clientes.

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

Actualmente `alentopizza.com` continúa ocupado por la solución construida en Glide. Alentó App se mantiene en infraestructura temporal mientras se completa y valida. Cuando el sistema esté listo para producción, el dominio principal debe migrarse a Alentó App.

No se busca un dominio diferente para cada módulo. La separación entre experiencia pública e interna se realizará por rutas, autenticación y permisos.

## Estado de desarrollo

**Punto de venta, Pedidos, Cocina, Clientes y Menú están cerrados para la etapa operativa actual.**

Estos módulos pueden recibir correcciones de bugs y ajustes menores, pero no deben reabrirse como fase de diseño salvo solicitud explícita.

La primera versión de Autenticación y Roles ya está implementada: colaboradores usan correo + contraseña y clientes disponen de acceso opcional por teléfono + OTP de WhatsApp. Antes de exposición definitiva todavía deben completarse endurecimientos de seguridad y la app pública. Integraciones externas permanece reservada para la última fase del desarrollo.

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
- impresión térmica de 80 mm;
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

## Próximo bloque estratégico: autenticación y roles

El sistema interno todavía **no tiene login ni protección por roles**.

Con POS, Pedidos y Cocina cerrados para esta etapa, este es ahora el siguiente bloque estratégico aprobado.

Antes de exponer Alentó App como reemplazo definitivo de Glide se debe implementar:

- modelo de usuarios internos;
- roles y permisos;
- contraseñas con hash seguro;
- sesiones;
- protección de páginas internas;
- protección de APIs internas;
- administración de usuarios;
- separación clara entre empleados y clientes.

Roles iniciales propuestos:

- `ADMIN`;
- `POS`;
- `KITCHEN`;
- `CASHIER`;
- `DISPATCH`.

La guía completa está en [`docs/AUTH_ROLES_AND_PUBLIC_APP.md`](docs/AUTH_ROLES_AND_PUBLIC_APP.md).

## Experiencia pública

La experiencia pública ya está en desarrollo activo y reutiliza el mismo motor de negocio del sistema interno.

La **Home principal está aprobada** y vive en `/`.

Incluye:

- pieza publicitaria a pantalla completa;
- imagen independiente para móvil y escritorio;
- administración desde `/personalizacion`;
- formato móvil `1080 × 2160 px`;
- formato escritorio `1920 × 1080 px`;
- CTA deslizante con flecha para entrar al menú;
- instalación PWA orientada al cliente.

El CTA de la Home lleva actualmente a `/menu`.

La pantalla `/pedir` consume el catálogo real, pero su diseño de productos **todavía está en definición**. No debe considerarse visualmente cerrada hasta aprobación explícita.

No debe existir un segundo sistema de pedidos. La experiencia pública debe compartir catálogo, configuradores, precios, promociones, cobertura, clientes, pedidos, pagos, configuración estructurada de `OrderItem` y consecutivo comercial global.

Las órdenes originadas por esta experiencia usarán `Order.source = WEB`.

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
- Acceso temporal actual del POS: `https://pos.alentopizza.com/`.
- Dominio comercial principal actual: `alentopizza.com`, todavía servido por Glide.

Los dominios/subdominios actuales deben entenderse como una etapa de transición. La arquitectura objetivo es un solo dominio principal.

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
- [`docs/ROADMAP.md`](docs/ROADMAP.md): orden de implementación por fases y criterios de cierre.
- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md): estado funcional actual.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): arquitectura y responsabilidades.
- [`docs/AUTH_ROLES_AND_PUBLIC_APP.md`](docs/AUTH_ROLES_AND_PUBLIC_APP.md): autenticación, permisos, dominio único y app pública.
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

Los cinco módulos operativos principales ya cerrados son POS, Pedidos, Cocina, Clientes y Menú.

Pendientes estratégicos conocidos:

1. Implementar usuarios internos, login y sesiones.
2. Proteger páginas y APIs internas.
3. Aplicar permisos por rol.
4. Crear administración de usuarios y auditoría básica.
5. Terminar Caja/conciliación y cierres operativos.
6. Inventario, recetas y costos usando los IDs estructurados guardados en pedidos.
7. Retomar mejoras estructurales de Menú cuando se aprueben: tipos de producto y modificadores.
8. Construir experiencia pública de pedidos reutilizando el mismo motor comercial.
9. Sustituir Glide y migrar `alentopizza.com` a Alentó App.
10. Evaluar empaquetado/parametrización para replicar la solución en otros negocios.
11. Implementaciones externas como Rappi/DiDi/Chatwoot se reservan para la última fase.


## Rutas principales vigentes

Durante la etapa temporal en `pos.alentopizza.com`:

- `/`: Home pública principal aprobada;
- `/menu`: experiencia pública de catálogo/productos;
- `/app2`: versión pública anterior conservada temporalmente para comparación;
- `/app`: alias temporal de la versión pública anterior;
- `/interno`: Punto de Venta protegido;
- `/login` y `/cuenta/login`: acceso unificado para clientes y colaboradores.

El acceso abre como cliente por teléfono + OTP y ofrece `Iniciar como colaborador` para cambiar a correo + contraseña. Cuando el producto esté listo, esta misma arquitectura pasará al dominio principal `alentopizza.com`.


## Personalización de la portada

Los banners promocionales de la experiencia pública se administran desde `/personalizacion` (ADMIN).

Formatos oficiales:

- Home móvil: `1080 × 2160 px`;
- Home escritorio: `1920 × 1080 px`;
- logo: `600 × 180 px`;
- banner principal: `1200 × 625 px`;
- banner secundario: `1200 × 310 px`.

Cada banner se asocia a un producto real del catálogo y reutiliza `AppSetting`, por lo que no introduce una tabla ni un esquema comercial adicional.


### Rutas de menú

- `/menu`: menú público para clientes.
- `/interno/menu`: administración interna del catálogo (ADMIN).
- `/pedir`: redirección temporal de compatibilidad hacia `/menu`.
