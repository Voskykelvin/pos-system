import { openDB } from 'idb';

const DB_NAME = 'pos-offline-db';
const DB_VERSION = 4;
const STORE_ORDERS = 'orders-queue';
const STORE_CATALOG = 'catalog-cache';
const STORE_DEAD_LETTER = 'dead-letter-queue';
const STORE_CONFIG = 'config-cache';
const STORE_HELD_SALES = 'held-sales';
const ENCRYPTION_KEY_ID = 'offlineEncryptionKey';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RETRIES = 5;

export const OFFLINE_SCHEMA_VERSION = 1;
export const OFFLINE_QUEUE_EVENT = 'pos-offline-queue-changed';

let dbPromise = null;
let encryptionKeyPromise = null;

function createUuid() {
  return globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function notifyQueueChanged() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
  }
}

async function payloadChecksum(payload) {
  const serialized = JSON.stringify(payload ?? null);
  if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') return `length-${serialized.length}`;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function requireWebCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues || typeof TextEncoder === 'undefined' || typeof TextDecoder === 'undefined') {
    throw new Error('Secure offline storage is not supported by this browser. Reconnect before completing this sale.');
  }
  return globalThis.crypto;
}

async function getEncryptionKey(db) {
  if (!encryptionKeyPromise) {
    encryptionKeyPromise = (async () => {
      const existing = await db.get(STORE_CONFIG, ENCRYPTION_KEY_ID);
      if (existing?.cryptoKey) return existing.cryptoKey;
      const cryptoApi = requireWebCrypto();
      const cryptoKey = await cryptoApi.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      try {
        await db.add(STORE_CONFIG, {
          key: ENCRYPTION_KEY_ID,
          cryptoKey,
          createdAt: new Date().toISOString()
        });
        return cryptoKey;
      } catch (error) {
        if (error?.name !== 'ConstraintError') throw error;
        const winner = await db.get(STORE_CONFIG, ENCRYPTION_KEY_ID);
        if (!winner?.cryptoKey) throw error;
        return winner.cryptoKey;
      }
    })().catch((error) => {
      encryptionKeyPromise = null;
      throw error;
    });
  }
  return encryptionKeyPromise;
}

async function encryptPayload(db, payload) {
  const cryptoApi = requireWebCrypto();
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const key = await getEncryptionKey(db);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload ?? null));
  const ciphertext = await cryptoApi.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    version: 1,
    algorithm: 'AES-GCM',
    iv: Array.from(iv),
    ciphertext: Array.from(new Uint8Array(ciphertext))
  };
}

async function decryptPayload(db, encryptedPayload) {
  if (!encryptedPayload || encryptedPayload.algorithm !== 'AES-GCM') {
    throw new Error('Encrypted offline payload is missing or unsupported');
  }
  const cryptoApi = requireWebCrypto();
  const key = await getEncryptionKey(db);
  const plaintext = await cryptoApi.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(encryptedPayload.iv) },
    key,
    new Uint8Array(encryptedPayload.ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

function withoutPlaintext(envelope) {
  const stored = { ...envelope };
  delete stored.payload;
  delete stored.decryptionError;
  return stored;
}

async function materializeEnvelope(db, envelope, storeName) {
  if (envelope.payload) {
    const migrated = {
      ...envelope,
      encryptedPayload: envelope.encryptedPayload || await encryptPayload(db, envelope.payload),
      encryptionVersion: 1
    };
    await db.put(storeName, withoutPlaintext(migrated));
    return migrated;
  }
  return { ...envelope, payload: await decryptPayload(db, envelope.encryptedPayload) };
}

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        let ordersStore;
        if (!db.objectStoreNames.contains(STORE_ORDERS)) {
          ordersStore = db.createObjectStore(STORE_ORDERS, { keyPath: 'id', autoIncrement: true });
        } else {
          ordersStore = transaction.objectStore(STORE_ORDERS);
        }
        if (!ordersStore.indexNames.contains('state')) ordersStore.createIndex('state', 'state');
        if (!ordersStore.indexNames.contains('deviceSequence')) {
          ordersStore.createIndex('deviceSequence', ['deviceId', 'sequence'], { unique: true });
        }
        if (!db.objectStoreNames.contains(STORE_CATALOG)) {
          db.createObjectStore(STORE_CATALOG, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_DEAD_LETTER)) {
          db.createObjectStore(STORE_DEAD_LETTER, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORE_CONFIG)) {
          db.createObjectStore(STORE_CONFIG, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_HELD_SALES)) {
          db.createObjectStore(STORE_HELD_SALES, { keyPath: 'scope' });
        }
      }
    });
  }
  return dbPromise;
}

export async function getDeviceIdentity() {
  const db = await getDb();
  const tx = db.transaction(STORE_CONFIG, 'readwrite');
  const store = tx.objectStore(STORE_CONFIG);
  let identity = await store.get('deviceIdentity');
  if (!identity) {
    identity = { key: 'deviceIdentity', deviceId: createUuid(), lastSequence: 0, createdAt: new Date().toISOString() };
    await store.put(identity);
  }
  await tx.done;
  return { deviceId: identity.deviceId, lastSequence: Number(identity.lastSequence || 0) };
}

export async function addOrderToQueue(orderPayload, context = {}) {
  const db = await getDb();
  const tx = db.transaction(STORE_CONFIG, 'readwrite');
  const configStore = tx.objectStore(STORE_CONFIG);
  let identity = await configStore.get('deviceIdentity');
  if (!identity) {
    identity = { key: 'deviceIdentity', deviceId: createUuid(), lastSequence: 0, createdAt: new Date().toISOString() };
  }
  const sequence = Number(identity.lastSequence || 0) + 1;
  identity.lastSequence = sequence;
  await configStore.put(identity);
  await tx.done;

  const capturedAt = new Date().toISOString();
  const payload = clone({
    ...orderPayload,
    offlineContext: {
      schemaVersion: OFFLINE_SCHEMA_VERSION,
      deviceId: identity.deviceId,
      sequence,
      capturedAt,
      tenantId: context.tenantId || null,
      cashierId: context.cashierId || null,
      items: clone(context.items || [])
    }
  });
  const envelope = {
    schemaVersion: OFFLINE_SCHEMA_VERSION,
    deviceId: identity.deviceId,
    sequence,
    idempotencyKey: `offline-${identity.deviceId}-${sequence}`,
    tenantId: context.tenantId || null,
    cashierId: context.cashierId || null,
    payload,
    payloadChecksum: await payloadChecksum(payload),
    encryptedPayload: await encryptPayload(db, payload),
    encryptionVersion: 1,
    state: 'queued',
    queuedAt: capturedAt,
    updatedAt: capturedAt,
    attempts: 0,
    nextRetryAt: null,
    lastError: null
  };
  const id = await db.add(STORE_ORDERS, withoutPlaintext(envelope));
  notifyQueueChanged();
  return { ...envelope, id };
}

export async function getQueuedOrders() {
  const db = await getDb();
  const orders = await db.getAll(STORE_ORDERS);
  const current = [];
  for (const order of orders) {
    if ((!order.payload && !order.encryptedPayload) || Number(order.schemaVersion || 0) < OFFLINE_SCHEMA_VERSION) {
      await rejectOrder(
        db,
        order,
        'legacy_queue_format_requires_manager_review',
        'conflict'
      );
    } else {
      try {
        current.push(await materializeEnvelope(db, order, STORE_ORDERS));
      } catch (error) {
        await rejectOrder(db, order, `offline_payload_decryption_failed: ${error.message}`, 'conflict');
      }
    }
  }
  return current;
}

export async function removeOrderFromQueue(id) {
  const db = await getDb();
  await db.delete(STORE_ORDERS, id);
  notifyQueueChanged();
}

export async function clearOrdersQueue() {
  const db = await getDb();
  await db.clear(STORE_ORDERS);
  notifyQueueChanged();
}

export async function cacheCatalog(products) {
  const db = await getDb();
  const tx = db.transaction(STORE_CATALOG, 'readwrite');
  for (const product of products) await tx.objectStore(STORE_CATALOG).put(product);
  await tx.done;
}

export async function getEncryptedHeldSales(scope) {
  const db = await getDb();
  const entry = await db.get(STORE_HELD_SALES, scope);
  if (!entry) return [];
  const sales = await decryptPayload(db, entry.encryptedPayload);
  return Array.isArray(sales) ? sales : [];
}

export async function saveEncryptedHeldSales(scope, heldSales) {
  const db = await getDb();
  await db.put(STORE_HELD_SALES, {
    scope,
    encryptedPayload: await encryptPayload(db, Array.isArray(heldSales) ? heldSales : []),
    encryptionVersion: 1,
    updatedAt: new Date().toISOString()
  });
}

export async function getCachedCatalog() {
  const db = await getDb();
  return db.getAll(STORE_CATALOG);
}

export async function getDeadLetterOrders({ includeResolved = false } = {}) {
  const db = await getDb();
  const entries = await db.getAll(STORE_DEAD_LETTER);
  const visible = includeResolved ? entries : entries.filter((entry) => entry.state !== 'resolved');
  return Promise.all(visible.map(async (entry) => {
    try {
      return await materializeEnvelope(db, entry, STORE_DEAD_LETTER);
    } catch (error) {
      return { ...entry, payload: null, decryptionError: error.message };
    }
  }));
}

export async function clearDeadLetterQueue() {
  const db = await getDb();
  await db.clear(STORE_DEAD_LETTER);
  notifyQueueChanged();
}

export async function retryDeadLetterOrder(id) {
  const db = await getDb();
  const entry = await db.get(STORE_DEAD_LETTER, id);
  if (!entry) return false;
  const payload = entry.payload || await decryptPayload(db, entry.encryptedPayload);
  if (await payloadChecksum(payload) !== entry.payloadChecksum) {
    await db.put(STORE_DEAD_LETTER, {
      ...withoutPlaintext(entry),
      state: 'conflict',
      rejectionReason: 'payload_integrity_check_failed',
      updatedAt: new Date().toISOString()
    });
    notifyQueueChanged();
    return false;
  }
  const tx = db.transaction([STORE_DEAD_LETTER, STORE_ORDERS], 'readwrite');
  const deadStore = tx.objectStore(STORE_DEAD_LETTER);
  const orderStore = tx.objectStore(STORE_ORDERS);
  const deadId = entry.id;
  const envelope = withoutPlaintext(entry);
  delete envelope.id;
  delete envelope.rejectedAt;
  delete envelope.rejectionReason;
  await orderStore.add({
    ...envelope,
    state: 'queued',
    attempts: 0,
    nextRetryAt: null,
    lastError: null,
    updatedAt: new Date().toISOString()
  });
  await deadStore.delete(deadId);
  await tx.done;
  notifyQueueChanged();
  return true;
}

export async function resolveDeadLetterOrder(id, { note, userId = null, userName = null } = {}) {
  const cleanNote = String(note || '').trim();
  if (!cleanNote) throw new Error('A reconciliation note is required');
  const db = await getDb();
  const entry = await db.get(STORE_DEAD_LETTER, id);
  if (!entry || entry.state === 'resolved') return false;
  await db.put(STORE_DEAD_LETTER, {
    ...withoutPlaintext(entry),
    state: 'resolved',
    resolvedAt: new Date().toISOString(),
    resolutionNote: cleanNote.slice(0, 500),
    resolvedByUserId: userId,
    resolvedByUserName: userName,
    updatedAt: new Date().toISOString()
  });
  notifyQueueChanged();
  return true;
}

async function rejectOrder(db, order, reason, state = 'rejected') {
  const protectedOrder = order.encryptedPayload
    ? order
    : { ...order, encryptedPayload: await encryptPayload(db, order.payload), encryptionVersion: 1 };
  const rejected = {
    ...withoutPlaintext(protectedOrder),
    state,
    rejectionReason: reason,
    rejectedAt: new Date().toISOString()
  };
  rejected.queueId = rejected.id;
  delete rejected.id;
  await db.add(STORE_DEAD_LETTER, rejected);
  await db.delete(STORE_ORDERS, order.id);
}

function retryDelayMs(attempts) {
  return Math.min(30_000 * (2 ** Math.max(attempts - 1, 0)), 30 * 60 * 1000);
}

async function markForRetry(db, order, error, state = 'retry') {
  const attempts = Number(order.attempts || 0) + 1;
  if (attempts >= MAX_RETRIES) {
    await rejectOrder(db, order, `max_retries_exceeded: ${error}`);
    return;
  }
  await db.put(STORE_ORDERS, withoutPlaintext({
    ...order,
    state,
    attempts,
    lastError: error,
    updatedAt: new Date().toISOString(),
    nextRetryAt: new Date(Date.now() + retryDelayMs(attempts)).toISOString()
  }));
}

export async function getOfflineQueueSummary() {
  const queued = await getQueuedOrders();
  const allReviewEntries = await getDeadLetterOrders({ includeResolved: true });
  const rejected = allReviewEntries.filter((order) => order.state !== 'resolved');
  const resolved = allReviewEntries.filter((order) => order.state === 'resolved');
  const states = queued.reduce((result, order) => {
    result[order.state || 'queued'] = (result[order.state || 'queued'] || 0) + 1;
    return result;
  }, {});
  return {
    queued: queued.length,
    rejected: rejected.length,
    resolved: resolved.length,
    states,
    orders: queued,
    rejectedOrders: rejected
  };
}

export async function syncOfflineOrders(authToken, { force = false, cashierId = null, tenantId = null } = {}) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { synced: 0, failed: 0, authRequired: 0 };
  const queuedOrders = await getQueuedOrders();
  let synced = 0;
  let failed = 0;
  let authRequired = 0;
  const db = await getDb();

  for (const order of queuedOrders.sort((a, b) => a.sequence - b.sequence)) {
    if (!force && order.nextRetryAt && new Date(order.nextRetryAt) > new Date()) continue;
    if (Date.now() - new Date(order.queuedAt).getTime() > MAX_AGE_MS) {
      await rejectOrder(db, order, 'stale_max_age_exceeded');
      failed += 1;
      continue;
    }
    if (await payloadChecksum(order.payload) !== order.payloadChecksum) {
      await rejectOrder(db, order, 'payload_integrity_check_failed', 'conflict');
      failed += 1;
      continue;
    }
    if (!authToken) {
      await db.put(STORE_ORDERS, withoutPlaintext({ ...order, state: 'auth_required', lastError: 'Sign in to synchronize this sale.' }));
      authRequired += 1;
      continue;
    }
    if (!cashierId || (order.cashierId && order.cashierId !== cashierId)) {
      await db.put(STORE_ORDERS, withoutPlaintext({
        ...order,
        state: 'auth_required',
        lastError: 'The cashier who captured this sale must sign in to synchronize it.',
        updatedAt: new Date().toISOString()
      }));
      authRequired += 1;
      continue;
    }
    if ((order.tenantId || null) !== (tenantId || null)) {
      await rejectOrder(db, order, 'tenant_context_mismatch', 'conflict');
      failed += 1;
      continue;
    }

    await db.put(STORE_ORDERS, withoutPlaintext({ ...order, state: 'syncing', updatedAt: new Date().toISOString() }));
    try {
      const response = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'Idempotency-Key': order.idempotencyKey
        },
        body: JSON.stringify(order.payload)
      });
      const responseBody = await response.json().catch(() => ({}));
      if (response.ok) {
        await db.delete(STORE_ORDERS, order.id);
        synced += 1;
      } else if (response.status === 401 || response.status === 402 || response.status === 403) {
        await db.put(STORE_ORDERS, withoutPlaintext({
          ...order,
          state: 'auth_required',
          lastError: responseBody.error || 'Authentication or subscription access is required.',
          updatedAt: new Date().toISOString()
        }));
        authRequired += 1;
      } else if (response.status === 409 && /still processing/i.test(responseBody.error || '')) {
        await markForRetry(db, order, responseBody.error || 'Request is still processing');
        failed += 1;
      } else if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        await rejectOrder(db, order, `${response.status}: ${responseBody.error || 'checkout_conflict'}`, 'conflict');
        failed += 1;
      } else {
        await markForRetry(db, order, `${response.status}: ${responseBody.error || 'temporary_server_error'}`);
        failed += 1;
      }
    } catch (error) {
      await markForRetry(db, order, `network_error: ${error.message}`);
      failed += 1;
    }
  }

  notifyQueueChanged();
  return { synced, failed, authRequired };
}

export async function registerBackgroundSync() {
  const db = await getDb();
  await db.delete(STORE_CONFIG, 'authToken'); // remove the legacy reusable credential cache
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('sync-offline-orders');
    } catch {
      // The foreground online listener remains the supported authenticated sync path.
    }
  }
}

export async function _resetOfflineDatabaseForTests() {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
    encryptionKeyPromise = null;
  }
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

export async function _getRawOfflineRecordsForTests() {
  const db = await getDb();
  return {
    queued: await db.getAll(STORE_ORDERS),
    rejected: await db.getAll(STORE_DEAD_LETTER),
    heldSales: await db.getAll(STORE_HELD_SALES)
  };
}
