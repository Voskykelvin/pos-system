# Jijenge POS Pilot Launch Pack

Use this pack to take one real store from setup to a controlled 7–14 day pilot. The objective is not merely to keep the application online: the store must complete sales, cash reconciliation, stock movement, payments, refunds, and recovery without losing financial evidence.

## Pack contents

- [Product import guide](PRODUCT_IMPORT_GUIDE.md) — prepare, validate, import, and verify the opening catalogue.
- [Cashier quick guide](CASHIER_QUICK_GUIDE.md) — open a shift, sell, handle offline mode, hold sales, and close the till.
- [Manager daily guide](MANAGER_DAILY_GUIDE.md) — supervise shifts, reconcile exceptions, approve returns, and close the day.
- [Incident response](INCIDENT_RESPONSE.md) — preserve evidence and recover safely when normal operating steps are insufficient.
- [Product import template](PRODUCT_IMPORT_TEMPLATE.csv) — replace the example rows with the pilot store’s products.

Print the cashier guide at each till. Keep the manager guide and incident contacts near the back-office device.

## Roles for the pilot

| Role | Named person | Responsibility |
| --- | --- | --- |
| Store owner | ____________________ | Final catalogue, prices, tax treatment, staff access, and go/no-go decisions. |
| Pilot manager | ____________________ | Opening checks, manager approvals, exception review, and daily sign-off. |
| Cashier lead | ____________________ | Till readiness, staff coaching, and immediate issue reporting. |
| Stock lead | ____________________ | Opening quantities, receipts, counts, transfers, and discrepancy investigation. |
| Jijenge support | Kelvin O., +254 703 920 254 | Technical escalation after store-side checks and evidence capture. |

Never share passwords, authenticator codes, M-Pesa credentials, eTIMS credentials, database URLs, or metrics tokens in a pilot chat group.

## Before staff training

### Store and access

- [ ] The subscription is active and the owner can reach the workspace.
- [ ] Store Setup shows the correct receipt business name, currency `KES`, country, time zone, return policy, and receipt footer.
- [ ] Every operating location exists under **Store Setup → Branches**.
- [ ] Each staff member has an individual account, correct role, and correct branch assignment.
- [ ] Administrators and managers have authenticator MFA enabled.
- [ ] A second administrator can sign in; the store is not dependent on one person’s phone.

### Payments and fiscal configuration

- [ ] The owner selected the correct M-Pesa collection mode: live integration, manual confirmation, or disabled.
- [ ] Sandbox credentials are never presented to cashiers as production payment collection.
- [ ] A real M-Pesa test covers success, cancellation/timeout, and manager review of an exception.
- [ ] If the store has an approved KRA/eTIMS setup, its environment, base URL, device serial, credential prefix, invoice, and credit-note behavior are verified.
- [ ] If the store has no KRA PIN/eTIMS identity, eTIMS is marked not configured/disabled; receipts must not accumulate in a fiscal queue.
- [ ] Product VAT categories have been confirmed by the owner or tax adviser. Software defaults are not tax advice.

### Catalogue, stock, and equipment

- [ ] Categories are created before product import.
- [ ] The import file has unique SKUs and barcodes and has passed the checks in the product import guide.
- [ ] Selling prices, cost prices, units, weighted-product flags, VAT categories, reorder levels, and opening quantities have been spot-checked.
- [ ] Opening stock is assigned to the correct operational branch.
- [ ] Lot-tracked products have batch, expiry, branch, and cost identity where required.
- [ ] Barcode scanner, phone camera permission, receipt printer, paper, cash drawer, charger, and backup internet are tested.
- [ ] A catalogue export and tested database backup exist before opening trade.

## Staff training script

Run training with sample products or a controlled low-value transaction:

1. Each cashier signs in with their own account and opens a shift with the counted opening float.
2. Complete one barcode sale and one text-search sale.
3. Change quantity, remove a line, attach a customer, and hold/resume a sale.
4. Complete cash, M-Pesa, and split-tender scenarios that the store will actually use.
5. Disconnect the test device, complete one permitted offline cash sale, reconnect, and confirm **Offline reconciliation** clears.
6. Search for the receipt in Operations and print it again.
7. Let a manager perform a controlled partial refund and confirm stock and net reporting.
8. Log a petty-cash expense, count the till, and close the shift.
9. Compare expected cash, counted cash, and variance; explain every difference.

Training is incomplete if staff can click through a sale but cannot explain what to do after a payment timeout, offline conflict, held sale, or cash variance.

## Suggested 14-day pilot

| Period | Focus | Exit condition |
| --- | --- | --- |
| Days 1–2 | Assisted trading | Support observes opening, checkout, receipts, and close without financial mismatch. |
| Days 3–5 | Normal store rhythm | Staff work independently; issues are recorded with receipt/request IDs and severity. |
| Days 6–7 | Recovery exercises | Offline cash sync, payment exception review, backup evidence, and one controlled restore drill are demonstrated. |
| Days 8–12 | Stability | No unresolved SEV-1/SEV-2 issue; daily cash and stock exceptions have named explanations. |
| Days 13–14 | Decision | Owner signs off, extends the pilot with conditions, or stops rollout with evidence. |

## Daily pilot scorecard

Complete one row per trading day. Attach detailed issue references separately rather than placing customer data in this table.

| Date | Orders | Gross sales | Refunds | Cash expected | Cash counted | Variance | Offline queued / unresolved | M-Pesa exceptions | eTIMS failed | Stock discrepancies | Staff friction (1–5) | Manager sign-off |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| | | | | | | | | | | | | |
| | | | | | | | | | | | | |
| | | | | | | | | | | | | |

For staff friction, `1` means the workflow was effortless and `5` means staff required repeated help or used a workaround.

## Issue record

Record each issue with:

- occurrence time and business impact;
- store, branch, role, device, and browser;
- screen and action being performed;
- receipt/order number, request ID, payment reference, or product SKU where safe;
- expected result and actual result;
- screenshot with customer/payment secrets hidden;
- whether retrying would risk a duplicate payment, sale, refund, or stock movement;
- workaround used and person who approved it.

Classify issues as **financial integrity**, **trading blocker**, **workflow degradation**, **usability**, or **enhancement**. Financial-integrity concerns always outrank cosmetic requests.

## Go-live decision

Proceed beyond the pilot only when:

- seven consecutive trading days close with explained cash variances;
- there are no unresolved duplicate, missing, or incorrectly valued orders, payments, refunds, fiscal records, or stock movements;
- every offline sale and payment exception has a documented outcome;
- the backup/restore drill and incident contacts have been tested;
- cashiers can operate without constant technical support;
- the owner accepts the current workflow and remaining low-risk limitations.

Do not expand to more stores to “test at scale” while the first store still has unexplained financial discrepancies.
