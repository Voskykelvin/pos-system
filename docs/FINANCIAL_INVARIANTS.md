# Financial and Inventory Invariants

This document records correctness rules enforced by the application and database. These rules are part of the transactional contract and must be updated whenever checkout, inventory, promotions, loyalty, credit, voids, or refunds change.

## Checkout

- A checkout runs in one database transaction.
- Duplicate request lines for the same product are consolidated before stock validation.
- Quantities must be positive and use no more than three decimal places.
- Product rows are locked before stock is validated and deducted.
- A completed deduction cannot leave product stock below zero.
- Prices, costs, tax rates, and line totals are snapshotted on order items.
- One payment row is accepted per payment method.
- Non-cash tender cannot exceed the order total, while excess cash is recorded as change.
- Loyalty redemption, loyalty earning, customer credit, payments, promotion usage, inventory movements, the order, and the eTIMS queue entry commit or roll back together.

## Idempotency

Checkout clients should send a unique `Idempotency-Key` of at most 200 characters.

- Keys are scoped by tenant and authenticated user.
- A completed response is replayed for the same method, route, and JSON body.
- Reusing a key for a different request returns `409`.
- A simultaneous request with the same key returns `409` while the first request is processing.
- The current store is process-local and expires after 24 hours. It does not survive a restart and is not shared across multiple API instances. Persistent database-backed idempotency remains required before horizontal API scaling.

## Promotions

- Promotion rows are locked during checkout.
- start/end dates, minimum order value, maximum uses, and percentage limits are revalidated inside checkout.
- Usage increments in the sale transaction, preventing two committed sales from consuming the final allowed use.
- Percentage discounts cannot exceed 100%.

## Loyalty and Customer Credit

- The customer row is locked for checkout when a customer is selected.
- Credit-limit validation and ledger creation occur in the sale transaction.
- Point redemption and earning occur in the sale transaction.
- A full order reversal restores credit debt and reverses the order's net loyalty movement.
- Reversal is blocked if credit has already been repaid or earned points have already been spent; these cases require an explicit payout or loyalty adjustment rather than an incorrect negative balance.

## Refunds and Voids

- Order and product rows are locked during reversal.
- Transmitted eTIMS invoices cannot be silently voided or refunded.
- Each order item stores cumulative `refundedQuantity`.
- A partial refund cannot exceed the remaining refundable quantity, even across repeated requests.
- Duplicate item entries in one partial-refund request are consolidated.
- Partial refunds for credit tenders are blocked until a combined debt-adjustment and payout workflow is implemented.
- Operations displays the remaining refundable quantity and removes invalid full-refund/full-void actions after a partial refund.
- Every refund creates an immutable `order_refunds` record and one or more `order_refund_items` records.
- Refund lines preserve returned quantity, gross value, allocated discount, allocated inclusive tax, and net refund value.
- Split-tender refund allocations are persisted and rounded so their sum equals the refund total.
- Orders preserve cumulative refunded subtotal, VAT, discount, and total values.
- Daily reporting, analytics, product velocity, receipt search, and CSV exports use net values after recorded refunds.

## Database Constraints

Migration `017_financial_invariants.sql` adds constraints for:

- non-negative product stock;
- cumulative refunded quantity between zero and sold quantity;
- non-negative customer credit and loyalty balances;
- valid promotion usage counters;
- receipt-number uniqueness within a tenant or the single-store scope.

Migration `018_refund_ledger.sql` adds:

- refund headers and line-item ledgers;
- cumulative order refund totals;
- refund-total bounds and supporting reporting indexes.

## Known Next Work

Provider-side disbursement is deliberately separate from the accounting ledger. Cash refund allocations describe the expected drawer payout, while M-Pesa/card allocations still require provider refund or reversal confirmation before automated external settlement can be claimed. Refunds against transmitted eTIMS invoices create durable credit-note jobs; production tax compliance still depends on KRA certification and credentials.
- Refunds against transmitted fiscal invoices atomically create a persisted eTIMS credit note linked to the refund ledger and original invoice. Direct voids remain blocked after transmission.
- Store credit is a separate customer asset ledger, never the customer-debt balance. Refund-to-credit plus a new checkout forms the auditable exchange workflow.
- A store without a seller KRA PIN is treated as non-fiscal: checkout produces a normal sales receipt and never creates an eTIMS queue record. Adding a PIN opts the store into fiscal validation and durable transmission.
