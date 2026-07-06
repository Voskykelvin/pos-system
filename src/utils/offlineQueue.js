import { openDB } from 'idb';

const DB_NAME = 'pos-offline-db';
const DB_VERSION = 2;
const STORE_ORDERS = 'orders-queue';
const STORE_CATALOG = 'catalog-cache';
const STORE_DEAD_LETTER = 'dead-letter-queue';
const STORE_CONFIG = 'config-cache';

let dbPromise = null;

function createIdempotencyKey(prefix = 'checkout') {
  const randomPart = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomPart}`;
}

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_ORDERS)) {
          db.createObjectStore(STORE_ORDERS, { keyPath: 'id', autoIncrement: true });
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
      },
    });
  }
  return dbPromise;
}

// Orders queue

export async function addOrderToQueue(orderPayload) {
  const db = await getDb();
  await db.add(STORE_ORDERS, {
    ...orderPayload,
    idempotencyKey: orderPayload.idempotencyKey || createIdempotencyKey(),
    queuedAt: new Date().toISOString(),
    retries: 0
  });
}

export async function getQueuedOrders() {
  const db = await getDb();
  return await db.getAll(STORE_ORDERS);
}

export async function removeOrderFromQueue(id) {
  const db = await getDb();
  await db.delete(STORE_ORDERS, id);
}

export async function clearOrdersQueue() {
  const db = await getDb();
  await db.clear(STORE_ORDERS);
}

// Catalog cache

export async function cacheCatalog(products) {
  const db = await getDb();
  const tx = db.transaction(STORE_CATALOG, 'readwrite');
  for (const product of products) {
    tx.objectStore(STORE_CATALOG).put(product);
  }
  await tx.done;
}

export async function getCachedCatalog() {
  const db = await getDb();
  return await db.getAll(STORE_CATALOG);
}

// Dead Letter Queue

export async function getDeadLetterOrders() {
  const db = await getDb();
  return await db.getAll(STORE_DEAD_LETTER);
}

export async function clearDeadLetterQueue() {
  const db = await getDb();
  await db.clear(STORE_DEAD_LETTER);
}

// Background sync

export async function syncOfflineOrders(authToken) {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const queuedOrders = await getQueuedOrders();
  if (queuedOrders.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const db = await getDb();

  for (const order of queuedOrders) {
    // 1. Max Age Check (7 days)
    const queuedDate = new Date(order.queuedAt);
    const now = new Date();
    const ageMs = now - queuedDate;
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;

    if (ageMs > maxAgeMs) {
      await db.add(STORE_DEAD_LETTER, {
        ...order,
        dlqReason: 'stale_max_age_exceeded',
        dlqAt: new Date().toISOString()
      });
      await removeOrderFromQueue(order.id);
      failed++;
      continue;
    }

    try {
      const checkoutPayload = { ...order };
      const idempotencyKey = checkoutPayload.idempotencyKey;
      delete checkoutPayload.id;
      delete checkoutPayload.queuedAt;
      delete checkoutPayload.retries;
      delete checkoutPayload.idempotencyKey;

      const response = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'Idempotency-Key': idempotencyKey || createIdempotencyKey()
        },
        body: JSON.stringify(checkoutPayload)
      });

      if (response.ok) {
        await removeOrderFromQueue(order.id);
        synced++;
      } else {
        // Permanent client 4xx rejection (excluding auth token stale or rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 401 && response.status !== 429) {
          const resData = await response.json().catch(() => ({}));
          const errorMsg = resData.error || 'permanent_4xx_error';
          await db.add(STORE_DEAD_LETTER, {
            ...order,
            dlqReason: `permanent_client_error: ${response.status} - ${errorMsg}`,
            dlqAt: new Date().toISOString()
          });
          await removeOrderFromQueue(order.id);
          failed++;
        } else {
          // Transient/Auth issue, increment retries
          const currentRetries = (order.retries || 0) + 1;
          if (currentRetries >= 3) {
            await db.add(STORE_DEAD_LETTER, {
              ...order,
              dlqReason: 'max_retries_exceeded',
              dlqAt: new Date().toISOString()
            });
            await removeOrderFromQueue(order.id);
          } else {
            const tx = db.transaction(STORE_ORDERS, 'readwrite');
            await tx.objectStore(STORE_ORDERS).put({
              ...order,
              retries: currentRetries
            });
            await tx.done;
          }
          failed++;
        }
      }
    } catch (err) {
      const currentRetries = (order.retries || 0) + 1;
      if (currentRetries >= 3) {
        await db.add(STORE_DEAD_LETTER, {
          ...order,
          dlqReason: `network_error_max_retries: ${err.message}`,
          dlqAt: new Date().toISOString()
        });
        await removeOrderFromQueue(order.id);
      } else {
        const tx = db.transaction(STORE_ORDERS, 'readwrite');
        await tx.objectStore(STORE_ORDERS).put({
          ...order,
          retries: currentRetries
        });
        await tx.done;
      }
      failed++;
    }
  }

  return { synced, failed };
}

export async function registerBackgroundSync(authToken) {
  if (authToken) {
    try {
      const db = await getDb();
      const tx = db.transaction(STORE_CONFIG, 'readwrite');
      await tx.objectStore(STORE_CONFIG).put({ key: 'authToken', value: authToken });
      await tx.done;
    } catch (err) {
      console.warn('Failed to save authToken inside offline config cache:', err.message);
    }
  }
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('sync-offline-orders');
    } catch (err) {
      console.warn('Background sync registration failed:', err.message);
    }
  }
}
