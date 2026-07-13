# Offline Sales Design

Offline checkout is a controlled cash-sale capture mechanism, not a general bypass of online financial controls. The system preserves the original cart snapshot and either synchronizes it unchanged or places it in a visible conflict queue for review.

## Supported Offline Workflow

Offline checkout supports:

- authenticated cashiers whose application was loaded while online;
- products already present in the local catalog cache;
- cash tender only;
- immutable product, quantity, price, and tax snapshots;
- automatic foreground synchronization when connectivity returns;
- detailed cashier/manager conflict review and unchanged-payload retry.

Offline checkout deliberately blocks M-Pesa, card, customer credit, loyalty redemption, promotions, manual discounts, and customer-linked sales. Those workflows require current server/provider state.

## Device and Sale Identity

Each browser installation receives a persistent random device ID. Every queued sale receives an atomically incremented device sequence number. The tuple `(tenant, deviceId, sequence)` is unique on the server through migration `019_offline_sale_identity.sql`.

The queue uses `offline-{deviceId}-{sequence}` as its idempotency key. If the in-memory idempotency cache has expired or the API restarted, the persisted order identity still returns the previously accepted order rather than deducting stock twice.

Sequence gaps are allowed if the browser closes between reserving a sequence and writing the queue record. Reusing a sequence is not allowed.

## Immutable Envelope

IndexedDB stores a versioned envelope containing unencrypted routing metadata plus an AES-256-GCM encrypted sale payload. A non-extractable device key is generated through Web Crypto and stored as a structured `CryptoKey` in IndexedDB. The protected payload contains:

- schema version;
- device ID and sequence;
- tenant and cashier context;
- captured timestamp;
- checkout payload;
- product name, quantity, price, and tax snapshot;
- SHA-256 payload checksum where Web Crypto is available;
- queue state, attempts, error, and next retry time.

The payload is deep-cloned before encryption. A SHA-256 checksum is verified after decryption and before every upload or manual retry. A mismatch moves the envelope to conflict review rather than uploading modified data. Version 4 lazily encrypts readable version 3 envelopes when they are first loaded.

Held sales use the same encrypted device store. Existing held sales are migrated from local storage and the readable copy is removed only after encrypted persistence succeeds.

## Queue States

- `queued`: ready for synchronization;
- `syncing`: currently being submitted;
- `retry`: transient network, rate-limit, or server failure with exponential backoff;
- `auth_required`: the cashier must sign in again or restore subscription access;
- `conflict`: permanent price, tax, stock, validation, or integrity rejection moved to the review queue;
- `rejected`: stale or repeatedly failing envelope moved to the review queue.

Transient retries back off from 30 seconds to a maximum of 30 minutes. Five failed attempts or seven days in the queue moves a sale to review.

## Authentication Safety

Reusable authentication tokens are not stored in IndexedDB for background synchronization. Version 3 deletes the legacy cached token. The service worker only notifies an open client that synchronization is requested; the page performs the upload with its current session token.

If no authenticated client is open, queued sales remain safely on the device until the next authenticated session.
Only the cashier who captured the envelope can synchronize it; signing into the same till as another cashier does not reattribute queued sales.

## Server Reconciliation

Before accepting an offline sale, the server verifies:

- supported schema and identity fields;
- cash-only tender and absence of online-only adjustments;
- queued quantities match the immutable item snapshot;
- current product price matches the captured price;
- current tax classification matches the captured tax category;
- sufficient stock remains at synchronization time.

Price, tax, or stock changes never silently rewrite the queued transaction. They create a conflict that requires review.

## Conflict Review

The checkout review dialog shows the device sequence, capture time, retry count, immutable product/quantity/price snapshot, tender total, and exact rejection reason. A cashier may retry the unchanged envelope after stock or catalog data is corrected. Administrators and managers may mark a sale reconciled only with a note referencing the paper receipt, replacement order, or drawer action. Resolved records remain encrypted in local history instead of being silently deleted.

## Operational Limitations

- Queue storage is device-local; clearing browser data removes unsynchronized sales.
- A lost or damaged device can lose sales that were never synchronized.
- Browser encryption protects data at rest from casual storage inspection; it does not protect a running, compromised origin that can execute application code.
- Conflict payloads are immutable. Corrections require a new online transaction and a manager reconciliation note rather than editing captured evidence.
- Cross-device stock reservation is impossible while offline, so the server remains the final authority at synchronization.

Managers should reconcile the offline panel before shift close and should not clear browser data on tills with queued or rejected transactions.
