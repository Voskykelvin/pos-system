'use strict';

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-orders') {
    event.waitUntil(syncOrdersInBackground());
  }
});

async function syncOrdersInBackground() {
  try {
    const db = await openDbPromise();
    const tokenObj = await getStoreVal(db, 'config-cache', 'authToken');
    const authToken = tokenObj ? tokenObj.value : null;
    if (!authToken) return;

    const queuedOrders = await getStoreAll(db, 'orders-queue');
    if (!queuedOrders || queuedOrders.length === 0) return;

    for (const order of queuedOrders) {
      const queuedDate = new Date(order.queuedAt);
      const now = new Date();
      const ageMs = now - queuedDate;
      const maxAgeMs = 7 * 24 * 60 * 60 * 1000;

      if (ageMs > maxAgeMs) {
        await addStoreVal(db, 'dead-letter-queue', {
          ...order,
          dlqReason: 'stale_max_age_exceeded',
          dlqAt: new Date().toISOString()
        });
        await deleteStoreVal(db, 'orders-queue', order.id);
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
            'Idempotency-Key': idempotencyKey || `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`
          },
          body: JSON.stringify(checkoutPayload)
        });

        if (response.ok) {
          await deleteStoreVal(db, 'orders-queue', order.id);
        } else {
          if (response.status >= 400 && response.status < 500 && response.status !== 401 && response.status !== 429) {
            const resData = await response.json().catch(() => ({}));
            const errorMsg = resData.error || 'permanent_4xx_error';
            await addStoreVal(db, 'dead-letter-queue', {
              ...order,
              dlqReason: `permanent_client_error: ${response.status} - ${errorMsg}`,
              dlqAt: new Date().toISOString()
            });
            await deleteStoreVal(db, 'orders-queue', order.id);
          } else {
            const currentRetries = (order.retries || 0) + 1;
            if (currentRetries >= 3) {
              await addStoreVal(db, 'dead-letter-queue', {
                ...order,
                dlqReason: 'max_retries_exceeded',
                dlqAt: new Date().toISOString()
              });
              await deleteStoreVal(db, 'orders-queue', order.id);
            } else {
              await putStoreVal(db, 'orders-queue', {
                ...order,
                retries: currentRetries
              });
            }
          }
        }
      } catch (err) {
        const currentRetries = (order.retries || 0) + 1;
        if (currentRetries >= 3) {
          await addStoreVal(db, 'dead-letter-queue', {
            ...order,
            dlqReason: `network_error_max_retries: ${err.message}`,
            dlqAt: new Date().toISOString()
          });
          await deleteStoreVal(db, 'orders-queue', order.id);
        } else {
          await putStoreVal(db, 'orders-queue', {
            ...order,
            retries: currentRetries
          });
        }
      }
    }
  } catch (err) {
    console.error('PWA background sync failed:', err);
  }
}

// Simple IndexedDB wrapper for Service Worker context
function openDbPromise() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('pos-offline-db', 2);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getStoreVal(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getStoreAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteStoreVal(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function addStoreVal(db, storeName, value) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function putStoreVal(db, storeName, value) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
