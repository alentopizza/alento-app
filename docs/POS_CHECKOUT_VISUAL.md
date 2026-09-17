# POS checkout visual polish

## Scope

This change improves only the presentation of the POS order-closing flow. Business rules, APIs, order persistence, discounts, delivery fees, payment validation and cash-change calculations remain unchanged.

## Drawer CTA

The main POS drawer action now presents `CONTINUAR PEDIDO` in uppercase with stronger weight, larger type and improved contrast. Disabled state remains visually distinct.

## Checkout modal

The order-closing modal is widened on desktop to better support the amount of operational information shown during checkout.

Visual changes:

- wider desktop modal, capped at 1080 px;
- dark header with Alentó red accent line;
- stronger title hierarchy and more legible labels;
- two-column desktop layout with more space between operational modules and the order summary;
- delivery, discount and payment sections use larger touch targets and clearer borders;
- order summary has more room and remains sticky on desktop while scrolling the checkout body;
- order lines inside the summary are easier to read;
- total amount has stronger emphasis;
- footer actions are larger and easier to identify;
- layout collapses to a single column on narrower screens.

## Files

- `src/app/checkout-modal-polish.css`
- `src/app/layout.tsx`

## Deployment

No Prisma or database changes are required. A normal application redeploy is sufficient.
