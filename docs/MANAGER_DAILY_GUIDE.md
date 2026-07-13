# Manager Daily Guide

The manager owns the explanation of each day’s cash, payment, refund, stock, offline, and fiscal exceptions. Never erase evidence to make dashboards look clean.

## Opening checks

- [ ] Production readiness and login work on the primary and backup device.
- [ ] The correct branch and staff assignments are active.
- [ ] Each cashier opens one shift with a physically counted float.
- [ ] Scanner, printer, paper, phone camera, network, and backup internet are ready.
- [ ] Yesterday’s held sales, offline conflicts, M-Pesa exceptions, failed eTIMS records, and open variances have named owners.
- [ ] Critical low stock, expired/expiring lots, and outstanding purchase receipts are reviewed.

## During trade

- Watch **Today’s Multi-Till Shift Summary** for unexpected floats, cash expectations, counts, and variances.
- Ensure petty cash is recorded when it leaves the till, with the correct category and useful description.
- Approve discounts only after checking the cart and store policy. Enter manager credentials yourself.
- Review stockouts, unusually high quantities, repeated void/refund requests, and repeated offline operation.
- Use request IDs, receipt numbers, payment references, SKUs, and audit records when investigating; avoid assumptions from screenshots alone.

## M-Pesa exception handling

1. Open the exception in Operations and identify its order and payment.
2. Compare amount, phone/reference, provider statement, callback event, and existing receipt.
3. For a confirmed provider payment, record the externally verified receipt number and a meaningful resolution note through the provided manager action.
4. Dismiss only when evidence proves the callback must not change payment state.
5. Never confirm from the customer SMS alone and never reuse a receipt number.

Escalate immediately when the provider shows money received but the order cannot safely be matched, or when two orders appear linked to one payment.

## Offline conflict handling

1. Open **Offline reconciliation → Review conflicts**.
2. Compare the immutable captured price/item details, server state, physical receipt, cash collected, and cashier account.
3. Retry unchanged only when the server state is now valid and retry cannot duplicate a sale.
4. Mark reconciled only after recording a note that explains the accounting outcome.
5. If a replacement sale or refund is required, use normal audited workflows and reference both records in the incident note.

Do not clear browser storage until all queued and rejected sales have documented outcomes.

## Refunds and voids

1. Find the receipt under **Operations → Receipt search**.
2. Confirm customer request, product, refundable quantity, original tender, existing refunds, and return policy.
3. Choose the authorized refund destination and enter a useful reason.
4. For a partial refund, enter only the returned quantity; confirm the resulting net sale and restored stock.
5. For transmitted eTIMS invoices, use the supported fiscal credit-note path. Never alter or delete the original fiscal invoice.
6. Inspect the refund history and inventory movement after completion.

## eTIMS review

- If fiscal readiness is disabled because the store has no configured identity, no invoice queue is expected.
- If enabled, review queued, retrying, transmitted, and failed counts.
- Confirm network and tenant fiscal settings before retrying failures.
- Never invent a CU invoice number, retransmit an already transmitted invoice, or delete a failed record to hide it.
- Reversals of transmitted fiscal sales require the credit-note workflow.

## Stock control

- Receive purchase orders against the actual supplier delivery and actual branch.
- Use stock counts for physical variance, transfers for inter-branch movement, and write-offs for documented loss/expiry.
- Lot-tracked movements must retain the selected source lot, destination identity, cost, and expiry.
- Investigate negative, unexpectedly high, or cross-branch balances before making another adjustment.
- Do not use catalogue CSV import as a routine adjustment after opening stock is signed off.

## End-of-day close

1. Confirm each cashier has resolved held sales and synchronized offline sales.
2. Ensure all expenses are logged before cash counting.
3. Have cash counted physically, then close each shift with **Cash counted**.
4. Compare total floats, cash expected, cash counted, and total variance.
5. Review receipts, gross/net sales, refunds, payment mix, credit, promotions, and unusual discounts.
6. Review M-Pesa exceptions and enabled eTIMS failures; assign every unresolved item.
7. Review stock discrepancies, low stock, critical lots, and purchase receipts.
8. Complete the [daily pilot scorecard](PILOT_LAUNCH_PACK.md#daily-pilot-scorecard) and sign it.

Never create a fake expense, sale, refund, or stock adjustment solely to force a dashboard or till variance to zero.

## Escalation

Use [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) for trading outages, suspected compromise, data loss, duplicate financial writes, or widespread payment corruption. Capture an operational snapshot when authorized, preserve logs and IDs, and stop risky retries.

### Pilot contacts

| Need | Primary | Backup |
| --- | --- | --- |
| Store decision | ____________________ | ____________________ |
| Cash/payment approval | ____________________ | ____________________ |
| Stock decision | ____________________ | ____________________ |
| Daraja/provider | ____________________ | ____________________ |
| KRA/eTIMS adviser | ____________________ | ____________________ |
| Jijenge technical support | Kelvin O., +254 703 920 254 | ____________________ |
