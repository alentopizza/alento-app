# Cupones y descuentos por canal

Estado: **IMPLEMENTADO Y OPERATIVO**

Última actualización: **2026-10-26**.

Este documento define la fuente de verdad de cupones para POS y checkout público.

## Principio central

Un cupón tiene tres decisiones independientes:

- `active`: interruptor maestro; si está apagado no puede aplicarse en ningún canal;
- `visibleInPos`: permite mostrarlo y aplicarlo desde el POS;
- `visibleInCart`: permite mostrarlo y aplicarlo desde el checkout público.

No usar un único flag de visibilidad para todos los canales.

Los cupones históricos conservan compatibilidad con:

- `visibleInPos = true` por defecto;
- `visibleInCart = false` por defecto.

Esto evita publicar promociones antiguas al cliente de forma accidental.

## Modelo

`Coupon` conserva:

- `id`;
- `name`;
- `type = FIXED | PERCENTAGE`;
- `value`;
- `active`;
- `visibleInPos`;
- `visibleInCart`;
- timestamps;
- relación con pedidos.

## Administración

Ruta:

`/cupones`

La edición permite:

- activar/desactivar el cupón;
- mostrar/ocultar en POS;
- mostrar/ocultar en carrito;
- configurar valor fijo o porcentaje.

La tarjeta administrativa debe comunicar por separado el estado de POS y Carrito.

## POS

El POS consulta únicamente cupones:

`active = true AND visibleInPos = true`

La API de creación de pedidos vuelve a exigir esta regla. Ocultar un cupón del POS no debe ser solamente una decisión de interfaz.

La base elegible se calcula con la misma normalización canónica de pedidos usada por el resto del sistema:

`src/lib/orderLineNormalizer.ts`

No calcular elegibilidad desde `unitPrice` enviado por el navegador.

### Productos no acumulables

Los productos promocionales/no elegibles no forman parte de la base del cupón.

Si la base elegible es cero:

- el POS no debe permitir aplicar un cupón;
- debe explicar que el pedido no tiene productos elegibles.

Si el pedido mezcla productos elegibles y promociones, el cupón se aplica únicamente a la base elegible.

## Checkout público

Los cupones públicos se obtienen desde `GET /api/public-checkout`.

Solo se exponen cupones:

`active = true AND visibleInCart = true`

La elegibilidad del carrito se calcula mediante:

`POST /api/public-checkout/eligibility`

Esta ruta es pública por diseño y usa `normalizeOrderLine`; no reutilizar `/api/discount/eligibility`, porque esa ruta es interna/protegida para POS.

### Dónde se selecciona

La selección vive en el paso:

`Carrito → Entrega / totales`

No volver a pedir la selección en **Tus datos**.

Reglas de UX:

- los cupones ocupan el ancho completo, uno por fila;
- al seleccionar uno, el resumen actualiza inmediatamente el descuento y total;
- el cliente puede quitarlo antes de continuar;
- la selección se conserva si vuelve al paso anterior;
- la pantalla **Tus datos** usa el total ya descontado y no repite una tarjeta de cupón ni una segunda línea de descuento.

### Promociones

Si todo el carrito es no elegible/promocional:

- no mostrar tarjetas de cupones;
- mostrar de forma sutil y clara: **Esta compra no aplica para cupones de descuento**;
- explicar que los productos en promoción ya tienen un beneficio y no acumulan cupones.

Si el carrito mezcla productos elegibles y promociones:

- sí mostrar cupones;
- incluir la nota: **Algunos productos en promoción no acumulan cupón. El descuento se aplica solo a los productos elegibles.**

Si no existen campañas públicas y tampoco hay una exclusión que explicar, no renderizar un bloque vacío de beneficios.

## Cálculo seguro

La UI solo muestra una vista previa.

Al crear un pedido WEB, `POST /api/public-checkout`:

1. vuelve a normalizar cada línea;
2. recalcula la base elegible;
3. consulta el cupón por ID;
4. exige `active = true`;
5. exige `visibleInCart = true`;
6. recalcula el descuento;
7. limita un descuento fijo a la base elegible;
8. no descuenta domicilio;
9. persiste `couponId`, `couponName`, `discountSource = COUPON`, `discount` y total.

No aceptar porcentaje, valor del cupón, subtotal elegible ni descuento calculado por el navegador como verdad.

## Rendimiento público

La lista de cupones y el cálculo de ahorro se cargan en paralelo.

Objetivo UX:

- mostrar la lista disponible tan pronto responda la configuración;
- mientras termina la normalización del carrito puede mostrarse **Calculando ahorro...**;
- no bloquear toda la pantalla esperando el cálculo de elegibilidad;
- si al finalizar el cálculo el carrito no tiene base elegible, retirar la selección.

## No acumulación

El sistema soporta un solo descuento/cupón por pedido en este flujo.

No introducir acumulación de varios cupones sin una regla comercial y un modelo explícitos.

## Archivos principales

- `prisma/schema.prisma`;
- `src/app/cupones/page.tsx`;
- `src/app/api/coupons/route.ts`;
- `src/app/api/coupons/[id]/route.ts`;
- `src/app/api/discount/eligibility/route.ts`;
- `src/app/api/public-checkout/route.ts`;
- `src/app/api/public-checkout/eligibility/route.ts`;
- `src/components/OrderCheckoutModal.tsx`;
- `src/components/PublicCheckoutDelivery.tsx`;
- `src/components/PublicCheckoutCustomer.tsx`;
- `src/lib/orderLineNormalizer.ts`.

## Reglas de no regresión

- no volver a exponer todos los cupones activos automáticamente en la app;
- no usar la ruta interna de elegibilidad desde el checkout público;
- no confiar en precios enviados por el navegador;
- no descontar el domicilio;
- no mostrar cupones que producen ahorro cero;
- no repetir la selección del cupón en **Tus datos**;
- no registrar uso de un cupón oculto para el canal;
- POS y WEB deben compartir la misma regla canónica de elegibilidad.
