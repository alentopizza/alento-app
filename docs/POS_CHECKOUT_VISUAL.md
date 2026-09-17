# POS checkout visual polish

## Scope

This change improves only the presentation of the POS order-closing flow. Business rules, APIs, order persistence, discounts, delivery fees, payment validation and cash-change calculations remain unchanged.

## Drawer CTA

The main POS drawer action presents `CONTINUAR PEDIDO` in uppercase with stronger weight, larger type and improved contrast. Disabled state remains visually distinct.

## Checkout V2

The checkout was rebuilt with dedicated, stable CSS classes rather than depending on generic Tailwind selectors. This prevents the modal from being compressed by unrelated styles and makes the layout easier to maintain.

Desktop behavior:

- modal width up to 1180 px;
- two-column layout with operational controls on the left and order review on the right;
- dark Alentó header with red accent line;
- delivery, discount and payment modules use larger controls and clearer spacing;
- summary remains sticky while the checkout body scrolls;
- responsive fallback to one column below 980 px;
- mobile-specific adjustments below 640 px.

## Structured product review

The checkout summary now reads the structured product configuration already stored in the cart instead of relying only on the legacy `detail` string.

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
