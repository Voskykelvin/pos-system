# Product Import Guide

This guide prepares a real store catalogue for **Inventory → CSV Import/Export**. Managers and administrators can import or export products.

## Safest starting point

1. Create the store’s categories in Inventory first.
2. Select **Export Product Catalog CSV** and use that file as the structural reference.
3. Save an untouched copy of the export before editing.
4. Edit a working copy, then paste its CSV text into **Import / Update Catalog via CSV**.
5. Run **Process CSV Import** and read the added/updated totals.

The importer is transactional: an error rolls back the entire submitted import. Importing a SKU that already exists updates that product rather than creating a second one.

## Columns

| Header | Required | Meaning and accepted values |
| --- | --- | --- |
| `sku` | Yes | Store-unique product identifier. Existing SKU means update. Do not recycle old SKUs for different products. |
| `barcode` | No | Tenant-unique code stored as text. Preserve leading zeroes. Leave blank for products without a barcode. |
| `name` | Yes | Cashier-facing product name. Avoid commas in the current paste importer. |
| `category` | Recommended | Exact name of an existing store category. Unknown/blank categories fall back to the first available category. |
| `taxCategory` | Recommended | `standard`, `zero_rated`, or `exempt`. Accepted aliases include `16%`, `zero`, and `non_vat`; confirm treatment independently. |
| `unit` | Recommended | Examples: `each`, `kg`, `litre`, `pack`, or the store’s consistent unit label. Default is `each`. |
| `isWeighted` | Recommended | Use literal `true` only for weighted products; otherwise `false`. |
| `costPrice` | Recommended | Numeric acquisition cost in KES. Default is `0`. |
| `sellingPrice` | Yes | Numeric selling price in KES. |
| `reorderLevel` | Recommended | Numeric threshold for low-stock/reorder guidance. Default is `5`. |
| `stockQuantity` | Recommended | Absolute tenant-wide stock after import, not a quantity to add. Default is `0`. |

`categoryId` is also accepted for system-generated workflows, but store operators should normally use the readable category name.

## Important behavior

- SKU and barcode comparisons are scoped to the store tenant.
- A barcode already owned by another SKU stops and rolls back the import.
- Updating `stockQuantity` changes branch inventory by the difference between old and new stock using the user’s assigned/default operational branch.
- Do not use import as a purchase receipt or casual stock adjustment after launch. Use purchase receiving, stock counts, write-offs, or transfers so the operational history remains meaningful.
- The current paste importer uses simple comma separation. Do not place commas or embedded line breaks in product names/categories and do not rely on quoted-comma handling.
- Spreadsheet applications may convert long barcodes to scientific notation or remove leading zeroes. Format the barcode column as **Text** before entering codes, then inspect the raw CSV text.

## Pre-import checks

- [ ] File headers match the template.
- [ ] Every row has SKU, name, and selling price.
- [ ] SKUs are unique and contain no accidental spaces.
- [ ] Barcodes are unique, complete, and stored as text.
- [ ] No product/category field contains a comma or line break.
- [ ] Cost is not greater than selling price unless the owner explicitly accepts the loss.
- [ ] No selling price, cost, reorder level, or stock quantity is negative.
- [ ] Weighted flags and units agree (`kg` products are reviewed carefully).
- [ ] VAT classifications were confirmed for this catalogue.
- [ ] Opening quantities were physically counted and assigned to the correct branch.
- [ ] An export and database backup exist before a large update.

## Post-import verification

1. Confirm the success message reports the expected added and updated counts.
2. Search five representative products by name, SKU, and barcode.
3. Include one leading-zero barcode, one weighted product, one VAT-standard product, and one zero-rated/exempt product in the sample.
4. Confirm selling price, cost, unit, tax label, and stock on each sample.
5. Scan each sampled barcode at Checkout without confirming a sale.
6. Review low-stock/reorder suggestions and the inventory value for implausible results.
7. Export the catalogue again and retain it as the signed opening catalogue.

If the import fails, correct the source file and resubmit it. Do not partially recreate rows manually unless the owner records which products were handled outside the approved file.
