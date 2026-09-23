# POS checkout visual polish

## Scope

This change improves only the presentation of the POS order-closing flow. Business rules, APIs, order persistence, discounts, delivery fees, payment validation and cash-change calculations remain unchanged.

## Drawer CTA

The main POS drawer action presents `CONTINUAR PEDIDO` in uppercase with stronger weight, larger type and improved contrast. Disabled state remains visually distinct.

## Checkout final

The checkout uses dedicated, stable CSS classes rather than depending on generic modal/Tailwind selectors. This prevents unrelated POS styles from compressing the closing flow.

The final layout is intentionally responsive based on real available width:

- desktop modal can grow up to 1320 px;
- two-column mode is used only when there is enough room for both operational modules and the order summary;
- below 1180 px the checkout automatically switches to a single column rather than shrinking buttons and text;
- delivery tariff choices use three columns when space permits;
- payment methods use two columns for better readability;
- discount choices keep clear spacing and touch targets;
- dark Alentó header with red accent line remains consistent with the rest of the POS;
- footer actions stay visible and readable;
- mobile mode stacks choices and product details vertically.

The purpose of the higher responsive breakpoint is to prevent the failure mode where delivery, discount and payment controls were squeezed into narrow cards.

## Checkout actions

The close action is intentionally icon-only in the visual layer. The real button still contains the original `Cerrar` text in the DOM, but CSS presents it as a compact `×` control. This keeps the header cleaner without changing the click handler or business behavior.

Footer actions were also strengthened for readability:

- `Volver` uses a larger 14 px label and a 50 px touch target;
- `Crear pedido` uses a larger 14 px label, stronger weight, larger minimum width and red Alentó emphasis;
- button radii and spacing are aligned with the rest of the checkout;
- the helper copy remains secondary and does not compete with the main actions.

These overrides live in `src/app/checkout-actions-polish.css`, loaded after the main checkout stylesheet so the action refinements remain isolated and easy to maintain.

## Structured product review

The checkout summary reads the structured product configuration already stored in the cart instead of relying only on the legacy `detail` string.

Pizza lines show:

- size;
- crust;
- flavor 1 and flavor 2 only when the pizza is a two-flavor product;
- additional ingredients as tags.

A normal single-flavor pizza does not repeat a `Flavor` row because the product name already represents its flavor.

Combo lines show:

- each included pizza with size and flavor;
- combo-group selections such as side dish and beverage as tags.

Products excluded from coupons continue to show a `No acumula cupón` badge.

## Files

- `src/components/OrderCheckoutModal.tsx`
- `src/app/checkout-modal-polish.css`
- `src/app/checkout-actions-polish.css`
- `src/app/layout.tsx`

## Deployment

No Prisma or database changes are required. A normal application redeploy is sufficient.


## Domicilio automático en POS

El cierre del pedido POS ya no permite seleccionar manualmente una tarifa de domicilio.

Para pedidos `DELIVERY`:

- se usa la dirección Google validada del cliente;
- el modal consulta `POST /api/delivery/quote` y muestra el domicilio calculado automáticamente en el resumen;
- el operador no ve opciones como `Sin costo / Zona 2 / Zona 3`;
- la creación de `POST /api/orders` vuelve a calcular la ruta con Google Routes usando las coordenadas guardadas del cliente y el origen oficial de Alentó;
- el backend decide la banda/costo aplicable y conserva `deliveryZoneId / deliveryZoneName` solo como metadata interna del pedido;
- una dirección sin coordenadas Google o fuera de cobertura bloquea la creación del domicilio;
- la sección visible de **Zonas y tarifas** fue retirada de Configuración. Las bandas existentes permanecen como regla interna del cálculo automático para mantener compatibilidad con el checkout web y Routes API.

No reintroducir selección manual de tarifa en el POS.
