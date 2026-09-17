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
- `src/app/layout.tsx`

## Deployment

No Prisma or database changes are required. A normal application redeploy is sufficient.
