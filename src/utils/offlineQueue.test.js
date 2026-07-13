import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _getRawOfflineRecordsForTests,
  _resetOfflineDatabaseForTests,
  addOrderToQueue,
  getDeadLetterOrders,
  getDeviceIdentity,
  getEncryptedHeldSales,
  getQueuedOrders,
  resolveDeadLetterOrder,
  saveEncryptedHeldSales,
  syncOfflineOrders
} from './offlineQueue';

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
});

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
    const raw = await _getRawOfflineRecordsForTests();
    expect(raw.queued[0].payload).toBeUndefined();
    expect(raw.queued[0].encryptedPayload).toMatchObject({ algorithm: 'AES-GCM', version: 1 });
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

  it('retains a manager reconciliation record without keeping plaintext sale data', async () => {
    await addOrderToQueue(payload, context);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Insufficient stock while offline' })
    }));
    await syncOfflineOrders('active-token', {
      force: true,
      cashierId: 'cashier-1',
      tenantId: 'tenant-1'
    });
    const conflict = (await getDeadLetterOrders())[0];

    await resolveDeadLetterOrder(conflict.id, {
      note: 'Matched to the signed paper receipt and drawer total.',
      userId: 'manager-1',
      userName: 'Manager One'
    });

    expect(await getDeadLetterOrders()).toHaveLength(0);
    const history = await getDeadLetterOrders({ includeResolved: true });
    expect(history[0]).toMatchObject({
      state: 'resolved',
      resolvedByUserId: 'manager-1',
      resolutionNote: 'Matched to the signed paper receipt and drawer total.'
    });
    const raw = await _getRawOfflineRecordsForTests();
    expect(raw.rejected[0].payload).toBeUndefined();
    expect(raw.rejected[0].encryptedPayload.algorithm).toBe('AES-GCM');
  });

  it('encrypts held sales with the device key', async () => {
    const held = [{ id: 'held-1', customer: { phone: '0712345678' }, total: 65 }];
    await saveEncryptedHeldSales('tenant-1:cashier-1', held);

    expect(await getEncryptedHeldSales('tenant-1:cashier-1')).toEqual(held);
    const raw = await _getRawOfflineRecordsForTests();
    expect(raw.heldSales[0].customer).toBeUndefined();
    expect(raw.heldSales[0].encryptedPayload.algorithm).toBe('AES-GCM');
    expect(JSON.stringify(raw.heldSales[0])).not.toContain('0712345678');
  });
});
