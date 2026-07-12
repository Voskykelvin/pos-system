# Jijenge POS Design System

The interface preserves Jijenge's deep navy and emerald theme while prioritizing speed, legibility, and predictable cashier interaction. Operational screens should feel denser than marketing pages without reducing touch safety or financial clarity.

## Foundations

- Operational background: light slate (`--pos-bg`).
- Primary surfaces: white (`--pos-surface`).
- Navigation: deep navy (`--pos-sidebar`).
- Primary action and active state: emerald (`--pos-accent`).
- Destructive, warning, and success states use the shared status variables in `src/global.css`.
- Currency and quantities use tabular numerals and the monospace operational font where practical.

New components should use the existing CSS variables rather than introducing unrelated brand colors.

## Cashier Typography

- Grand totals must be visually dominant and at least 26px on operational screens.
- Phone grand totals are 28px.
- Confirmation actions are at least 19px and 60px high.
- Change due must be separated from tendered cash and use a large tabular value.
- Supporting tax and stock text may be smaller, but essential actions and financial values should not depend on text below 14px.

## Touch and Accessibility

- Primary phone controls use a minimum 44×44px target.
- Inputs use at least 16px text on phones to prevent browser zoom.
- Focus indicators use the emerald outline and must remain visible.
- Transaction progress uses polite live regions.
- Blocking errors use alert semantics.
- Motion honors `prefers-reduced-motion`.
- Fixed phone controls account for `safe-area-inset-bottom`.

## Responsive Checkout

Desktop and large tablet layouts show the catalog and cart side by side. At widths up to 720px, checkout becomes a two-pane phone workflow:

```text
Products → persistent item/total summary → Cart and payment → Receipt
    ↑                                           ↓
    └──────────── one-tap Products switch ─────┘
```

The fixed phone sale bar always exposes:

- Products navigation;
- item count and current total;
- Cart navigation.

Only one pane is visible on a phone. The confirm-sale control remains sticky above the sale bar while the cart is being reviewed. A completed receipt remains in the cart pane so the cashier can read the result and change due before returning to products.

## Supported Viewport Checks

Every checkout change should be reviewed at:

- 320px minimum phone width;
- 375px common Android/iPhone width;
- 430px large phone width;
- 720px compact tablet boundary;
- 900px tablet/desktop layout boundary;
- standard desktop till width.

The Playwright suite currently verifies a Pixel 5 profile and desktop Chromium. Additional 320px and tablet projects remain a future coverage improvement.

## Operational UI Rules

- Do not hide sign out, sync conflicts, failed payments, or fiscal warnings on small screens.
- Do not rely on hover for cashier actions.
- Do not change totals after confirmation without an explicit refund, void, or conflict workflow.
- Avoid dialogs for routine quantity changes.
- Keep catalog actions and payment actions visually distinct.
- Preserve the receipt and change-due result until the cashier deliberately starts or resumes another sale.
