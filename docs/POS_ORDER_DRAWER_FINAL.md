# POS order drawer — final docked variant

This document records the final visual refinement of the POS order panel.

## Goals

- Restore the `+` action for creating a new customer while keeping the compact search row.
- Make the order panel behave like a true right-side operational drawer on desktop.
- Keep the catalog fully usable and avoid covering it with the fixed drawer.
- Increase the available drawer width so customer and cart information are easier to read.
- Improve the visual hierarchy of the selected-customer card.
- Preserve the existing order logic, customer validation, cart behavior, checkout flow, and responsive behavior.

## Desktop behavior

At widths of 1280px and above, the order panel is fixed to the right edge of the viewport:

- responsive width: `clamp(430px, 28vw, 500px)`;
- top/right/bottom: `0`;
- full viewport height;
- left side rounded corners only;
- stronger shadow toward the catalog;
- the main grid reserves the same responsive width so the catalog is never covered;
- the gap between catalog and drawer is reduced to 12px to use the available screen space more efficiently.

This gives the POS the feel of a dedicated order side menu / order drawer while providing more usable space for customer details and product configuration summaries.

## Customer actions

When no customer is selected:

- the search input remains on the left;
- the black search button remains available;
- the red `+` button is restored immediately to the right of the search action;
- both controls have the same 42×42 size and radius.

The original button remains the real DOM action (`openNewCustomer`); CSS only changes its position and presentation.

When a customer is selected:

- the customer card uses slightly more vertical padding;
- customer name is larger and darker;
- phone/address text is larger with improved contrast;
- Edit / Change actions use larger touch targets and more readable text;
- the card makes use of the wider drawer instead of keeping the previous compact typography.

## Responsive behavior

Below 1280px the panel returns to normal document flow:

- no fixed positioning;
- complete border radius;
- standard shadow;
- no viewport docking.

## Files

- `src/app/pos-order-drawer.css`: base drawer layout.
- `src/app/pos-order-drawer-final.css`: final right docking, responsive width, restored `+` customer action, and selected-customer readability.
- `src/app/layout.tsx`: imports the final override after the previous POS visual layers.

## Functional impact

No API, Prisma, database, cart, order, customer, or checkout logic was changed. This change is presentation-only.
