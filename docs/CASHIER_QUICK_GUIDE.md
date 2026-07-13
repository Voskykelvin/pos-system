# Cashier Quick Guide

Use your own Jijenge account. Never share passwords, manager approvals, or authenticator codes.

## Start the shift

1. Sign in and open **Operations**.
2. Count the physical opening cash before entering it.
3. Enter **Opening float** and select **Open shift**.
4. Confirm the screen shows an open shift and the correct float.
5. Check the scanner, receipt paper, network, and M-Pesa instructions before serving the first customer.

## Complete a normal sale

1. Open **Checkout**.
2. Scan the barcode into **Scan barcode or search a product…**, or type at least two characters of the product name.
3. Select the product and confirm its name, price, unit, VAT label, and available stock.
4. Use `+`, `−`, or **Remove** to correct the cart. On a phone, use **Products** and **Cart** to switch panes.
5. Attach the customer only when the customer agrees and their details are correct.
6. Select the actual tender. For cash, enter **Cash received** and read the displayed change before confirming.
7. Select **Confirm sale – KES …** once. Do not double-click or create a second sale because a response is slow.
8. Read the success/payment state, give the displayed change, and print or share the correct receipt.

The keyboard shortcuts shown at the till are `F2` to hold, `F4` to return to scan/search, and `Ctrl+Enter` to confirm when confirmation is allowed.

## M-Pesa

- Confirm the customer phone and amount before sending the request.
- While the screen says **Waiting for customer to enter M-Pesa PIN**, do not resend or hold the sale.
- A customer SMS alone is not final proof when Jijenge shows an exception. Call the manager to verify the provider record.
- If payment fails, follow the on-screen choice: retry M-Pesa, switch to cash, or have a manager inspect/void any backend receipt.
- Never mark a payment successful manually and never copy a receipt number from another transaction.

## Split tender

Enter each real tender and ensure the combined amount covers the displayed total. Confirm cash received and change independently from the M-Pesa portion. If the split is wrong, correct it before confirming; do not “balance it later” with an unrecorded cash adjustment.

## Hold and resume a sale

1. Add a useful **Hold note**, such as “customer fetching cash”. Do not put sensitive customer information in the note.
2. Select **Hold sale** or press `F2`.
3. To resume, open **Held**, choose the correct sale, and check every line before payment.
4. Remove abandoned held sales according to store policy. Do not leave held sales unresolved at shift close.

## Offline mode

- The banner states that only cash sales can be queued offline. M-Pesa, credit, and price-sensitive adjustments require internet.
- Complete the cash sale normally and give the offline receipt reference.
- When internet returns, select **Sync now** under **Offline reconciliation** and wait for the waiting count to clear.
- If **Review conflicts** appears, stop retrying and call a manager. A price/product conflict must be reviewed against the physical sale.
- Never clear site data, reinstall the PWA, sign out repeatedly, or use a cleaner application while offline sales are waiting or under review.

## Discounts and corrections

- Apply only the approved promotion/discount.
- When manager approval appears, the manager enters their own credentials privately.
- Before confirmation, correct the cart directly.
- After confirmation, never edit the receipt or compensate with an unrecorded sale. A manager must use the audited refund/void workflow in Operations.

## Close the shift

1. Finish or remove held sales and sync all offline sales.
2. Hand unresolved M-Pesa, eTIMS, receipt, or offline exceptions to the manager.
3. Record every till expense through **Log Petty Cash Expense**; do not hide it in the cash count.
4. Count cash away from customers. Count twice if it differs from expectation.
5. Enter **Cash counted** and select **Close shift**.
6. Tell the manager the variance and its known reason. Never change the opening float or invent an expense to force a zero variance.

## Stop and call the manager when

- the customer may have been charged but Jijenge does not show a confirmed payment;
- a sale, receipt, refund, or stock movement appears duplicated or missing;
- an offline conflict appears;
- the price/VAT/unit differs from the shelf or approved catalogue;
- the shift cannot close or the variance is unexplained;
- the screen asks for manager approval;
- you suspect another person used your account.

Record the time, screen, receipt/order number, product SKU, and request ID when visible. Hide customer and credential details in screenshots.
