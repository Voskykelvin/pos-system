import { beforeEach, describe, expect, it, vi } from 'vitest';
import idempotencyModule from './idempotency';

const { _clearStore, idempotency } = idempotencyModule;

function createExchange({ key = 'sale-1', body = { total: 100 } } = {}) {
  const req = {
    method: 'POST',
    originalUrl: '/api/orders/checkout',
    body,
    tenantId: 'tenant-1',
    user: { id: 'cashier-1' },
    get: vi.fn((name) => name === 'Idempotency-Key' ? key : undefined)
  };
  const res = {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    json: vi.fn(function json(payload) { this.body = payload; return this; })
  };
  return { req, res, next: vi.fn() };
}

describe('idempotency middleware', () => {
  beforeEach(_clearStore);

  it('replays a completed response for the same request', () => {
    const middleware = idempotency();
    const first = createExchange();
    middleware(first.req, first.res, first.next);
    first.res.status(201).json({ orderId: 'order-1' });

    const replay = createExchange();
    middleware(replay.req, replay.res, replay.next);

    expect(replay.next).not.toHaveBeenCalled();
    expect(replay.res.statusCode).toBe(201);
    expect(replay.res.body).toEqual({ orderId: 'order-1' });
    expect(replay.res.headers['Idempotency-Replayed']).toBe('true');
  });

  it('rejects reuse of a key with a different payload', () => {
    const middleware = idempotency();
    const first = createExchange();
    middleware(first.req, first.res, first.next);

    const conflicting = createExchange({ body: { total: 200 } });
    middleware(conflicting.req, conflicting.res, conflicting.next);

    expect(conflicting.res.statusCode).toBe(409);
    expect(conflicting.res.body.error).toMatch(/different request/i);
  });

  it('rejects unbounded keys', () => {
    const exchange = createExchange({ key: 'x'.repeat(201) });
    idempotency()(exchange.req, exchange.res, exchange.next);

    expect(exchange.res.statusCode).toBe(400);
    expect(exchange.next).not.toHaveBeenCalled();
  });
});
