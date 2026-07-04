# Analytics Product Batch Plan

This plan turns Jijenge POS analytics into a stronger store-owner and SaaS-owner product area. Code work should land before each batch is marked complete.

## Batch 1 - Store Analytics Backend

Status: Complete

- Add sales trend data for charts.
- Add payment mix, category mix, staff performance, and customer metrics.
- Add real conversion metrics from data already captured by the POS:
  - paid-order conversion from all attempted orders
  - customer capture rate
  - repeat customer rate
- Add inventory intelligence with velocity, days of stock remaining, reorder urgency, and suggested purchase quantity.

## Batch 2 - Platform Analytics Backend

Status: Complete

- Expand `/api/super-admin/dashboard` beyond static counts.
- Add SaaS owner metrics:
  - signup-to-active conversion
  - MRR by plan
  - new stores over time
  - active stores with sales in the period
  - tenant activity and risk signals
- Return plan metadata so pricing tiers and feature packaging can be rendered consistently.

## Batch 3 - Frontend Analytics UI

Status: Complete

- Add real charts to the store analytics screen.
- Add stock recommendations that explain why an item should be reordered.
- Add owner dashboard charts for MRR, plan mix, signups, and store activity.
- Add tier cards for Starter, Growth, and Enterprise features.

## Batch 4 - Final Pass

Status: Complete

- Run build and smoke tests.
- Run audit and document any dependency risk that should not be force-fixed.
- Scan for mojibake and obvious dead code.
- Review backend-to-frontend analytics wiring.
- Push only after the final pass is clean enough.
