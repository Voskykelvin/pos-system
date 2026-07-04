import { openDB } from 'idb';

const DB_NAME = 'pos-offline-db';
const DB_VERSION = 1;
const STORE_ORDERS = 'orders-queue';
const STORE_CATALOG = 'catalog-cache';

let dbPromise = null;

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
      },
    });
  }
  return dbPromise;
}

// ─── Orders Queue ─────────────────────────────────────────────────────────────

export async function addOrderToQueue(orderPayload) {
  const db = await getDb();
  await db.add(STORE_ORDERS, {
    ...orderPayload,
    queuedAt: new Date().toISOString()
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

// ─── Catalog Cache ────────────────────────────────────────────────────────────

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

// ─── Background Sync ──────────────────────────────────────────────────────────

export async function syncOfflineOrders(authToken) {
  if (!navigator.onLine) return { synced: 0, failed: 0 };
  
  const queuedOrders = await getQueuedOrders();
  if (queuedOrders.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const order of queuedOrders) {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(order)
      });
      
      if (response.ok) {
        await removeOrderFromQueue(order.id);
        synced++;
      } else {
        // If it's a 4xx error (like bad request), maybe we should delete it or flag it
        // For now, if it fails, it stays in the queue to be retried
        failed++;
      }
    } catch (err) {
      failed++;
    }
  }

  return { synced, failed };
}
