'use strict';

// Authentication credentials are intentionally never persisted for the
// service worker. Background Sync wakes an open client, which performs the
// upload with its current in-memory session token.
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-orders') {
    event.waitUntil(notifyClients());
  }
});

async function notifyClients() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of windows) {
    client.postMessage({ type: 'OFFLINE_SYNC_REQUESTED' });
  }
}
