import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  _resetOfflineDatabaseForTests,
  addOrderToQueue,
  getDeadLetterOrders,
  getDeviceIdentity,
  getQueuedOrders,
  syncOfflineOrders
} from './offlineQueue';

afterEach(async () => {
  vi.unstubAllGlobals();
  await _resetOfflineDatabaseForTests();
});

const payload = {
  items: [{ productId: 'milk', quantity: 1 }],
  payments: [{ method: 'cash', amount: 65 }]
};
const context = {
  tenantId: 'tenant-1',
  cashierId: 'cashier-1',
  items: [{ productId: 'milk', name: 'Milk', quantity: 1, unitPrice: 65, taxCategory: 'zero_rated' }]
};

describe('offline sale queue', () => {
  it('assigns persistent device identity and monotonic immutable envelopes', async () => {
    const mutablePayload = JSON.parse(JSON.stringify(payload));
    const first = await addOrderToQueue(mutablePayload, context);
    mutablePayload.items[0].quantity = 99;
    const second = await addOrderToQueue({
      items: [{ productId: 'bread', quantity: 1 }],
      payments: [{ method: 'cash', amount: 70 }]
    }, { ...context, items: [{ productId: 'bread', quantity: 1, unitPrice: 70, taxCategory: 'zero_rated' }] });
    const identity = await getDeviceIdentity();

    expect(first.deviceId).toBe(second.deviceId);
    expect([first.sequence, second.sequence]).toEqual([1, 2]);
    expect(identity.lastSequence).toBe(2);
    expect((await getQueuedOrders())[0].payload.items[0].quantity).toBe(1);
    expect(first.idempotencyKey).toContain(`${first.deviceId}-1`);
  });

  it('removes a sale only after the server accepts it', async () => {
    await addOrderToQueue(payload, context);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ orderId: 'order-1' }) }));

    const result = await syncOfflineOrders('active-token', {
      force: true,
      cashierId: 'cashier-1',
      tenantId: 'tenant-1'
    });

    expect(result.synced).toBe(1);
    expect(await getQueuedOrders()).toHaveLength(0);
    expect(fetch).toHaveBeenCalledWith('/api/orders/checkout', expect.objectContaining({
      headers: expect.objectContaining({ 'Idempotency-Key': expect.stringMatching(/^offline-/) })
    }));
  });

  it('keeps auth failures queued and isolates permanent conflicts for review', async () => {
    await addOrderToQueue(payload, context);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Auth token expired' })
    }));
    await syncOfflineOrders('expired-token', {
      force: true,
      cashierId: 'cashier-1',
      tenantId: 'tenant-1'
    });
    expect((await getQueuedOrders())[0].state).toBe('auth_required');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Price changed while offline' })
    }));
    await syncOfflineOrders('new-token', {
      force: true,
      cashierId: 'cashier-1',
      tenantId: 'tenant-1'
    });
    expect(await getQueuedOrders()).toHaveLength(0);
    expect((await getDeadLetterOrders())[0]).toMatchObject({ state: 'conflict' });
  });

  it('does not reattribute a queued sale to a different cashier', async () => {
    await addOrderToQueue(payload, context);
    vi.stubGlobal('fetch', vi.fn());

    const result = await syncOfflineOrders('active-token', {
      force: true,
      cashierId: 'cashier-2',
      tenantId: 'tenant-1'
    });

    expect(result.authRequired).toBe(1);
    expect((await getQueuedOrders())[0]).toMatchObject({
      state: 'auth_required',
      cashierId: 'cashier-1'
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
