# POS order drawer — final docked variant

This document records the final visual refinement of the POS order panel.

## Goals

- Restore the `+` action for creating a new customer while keeping the compact search row.
- Make the order panel behave like a true right-side operational drawer on desktop.
- Keep the catalog fully usable and avoid covering it with the fixed drawer.
- Preserve the existing order logic, customer validation, cart behavior, checkout flow, and responsive behavior.

## Desktop behavior

At widths of 1280px and above, the order panel is fixed to the right edge of the viewport:

- width: 390px;
- top/right/bottom: 0;
- full viewport height;
- left side rounded corners only;
- stronger shadow toward the catalog;
- the main grid still reserves 390px so the catalog is never covered.

This gives the POS the feel of a dedicated order side menu / order drawer.

## Customer actions

When no customer is selected:

- the search input remains on the left;
- the black search button remains available;
- the red `+` button is restored immediately to the right of the search action;
- both controls have the same 42×42 size and radius.

The original button remains the real DOM action (`openNewCustomer`); CSS only changes its position and presentation.

When a customer is already selected, the `+` action is not forced into the selected-customer card. Existing Edit / Change behavior remains unchanged.

## Responsive behavior

Below 1280px the panel returns to normal document flow:

- no fixed positioning;
- complete border radius;
- standard shadow;
- no viewport docking.

## Files

- `src/app/pos-order-drawer.css`: base drawer layout.
- `src/app/pos-order-drawer-final.css`: final right docking and restored `+` customer action.
- `src/app/layout.tsx`: imports the final override after the previous POS visual layers.

## Functional impact

No API, Prisma, database, cart, order, customer, or checkout logic was changed. This change is presentation-only.
