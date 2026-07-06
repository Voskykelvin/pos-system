# Kenya VAT Product Classification

Last checked: 2026-07-06.

This project must classify VAT at product level, not only by broad category. A single category such as `Groceries` can contain standard-rated, zero-rated, and exempt items.

## Current Rate Model

Official KRA guidance lists two current VAT rates:

- `standard`: 16% general VAT.
- `zero_rated`: 0% VAT for supplies listed in the Second Schedule.
- `exempt`: no VAT charged for supplies listed in the First Schedule.

Sources:

- KRA VAT rates: https://www.kra.go.ke/individual/filing-paying/types-of-taxes/value-added-tax
- VAT Act, latest Kenya Law version checked: https://new.kenyalaw.org/akn/ke/act/2013/35/eng@2025-07-01

## Common Retail Examples To Check

Set product `taxCategory` to `zero_rated` for current Second Schedule retail items such as:

- Ordinary bread.
- Milk and cream that is not concentrated and does not contain added sugar or other sweetening matter.
- Liquefied Petroleum Gas.

Set product `taxCategory` to `exempt` for current First Schedule items such as:

- Live animals.
- Meat and edible meat offals, subject to tariff exclusions.
- Fish and crustaceans, subject to tariff exclusions.
- Unprocessed milk.
- Fresh birds' eggs in shell.
- Edible vegetables, roots, and tubers, subject to tariff exclusions.
- Edible fruits and nuts, subject to tariff exclusions.
- Cereals of Chapter 10, subject to tariff exclusions.

Everything else should remain `standard` unless the current VAT Act, KRA guidance, or a tax professional confirms another treatment.

## Operating Rule

When adding or importing products, always set `taxCategory` on the product row. Category tax is only a fallback/default. If an item name looks like a basic food but has added sugar, processing, restaurant supply, packaging, or a tariff-code exception, confirm before marking it zero-rated or exempt. Milk is especially form-specific: unprocessed milk is listed as exempt, while some milk and cream tariff lines are listed as zero-rated.
