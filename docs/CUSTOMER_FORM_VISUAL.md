# Customer form visual standard

Updated: 2026-09-16

## Purpose

Unify the visual language of customer forms across the POS and the Customers administration module without changing persistence, validation, endpoints, or customer history behavior.

## Scope

The visual standard applies to:

- POS: create customer modal.
- POS: edit selected customer modal (same component/state flow used by create/edit).
- `/clientes`: edit customer modal.

## Design language

- Dark header matching the POS order drawer.
- Alentó red accent line.
- Warm neutral form background.
- Compact white inputs with subtle borders.
- System UI typography for readability.
- Reduced vertical whitespace.
- Clearer focus state using a subtle red ring.
- Compact footer actions.
- Responsive single-column form on small screens.

## POS customer form

The POS form keeps the existing logic in `src/components/StructuredPosPage.tsx`.

No customer API behavior changed. The modal still uses:

- `POST /api/customers` to create.
- `PATCH /api/customers/[id]` to edit.
- Name and phone validation.
- Address required only when fulfillment is delivery.

The visual override lives in:

- `src/app/customer-modal-polish.css`

## Customers module edit form

The existing `/clientes` edit modal keeps its current logic and API calls. The same stylesheet aligns it visually with the POS modal and order drawer.

## Important rule

This change is presentation-only. Do not remove or weaken customer validation or customer/order history behavior when refining this interface later.
