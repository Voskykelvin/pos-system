/**
 * Idempotency key middleware for state-changing endpoints.
 *
 * Clients send:
 *   Idempotency-Key: <any string, typically a UUID>
 *
 * Behaviour:
 *   - First request  -> passes through; response is stored in-memory.
 *   - Same key again -> cached response is replayed instantly.
 *   - Same key while first is in-flight -> 409 { error: 'Request is still processing' }.
 *   - No header      -> passes through with no idempotency guarantee.
 *
 * Storage:
 *   In-memory Map; entries expire after IDEMPOTENCY_TTL_MS (default 24 h).
 *   This is intentionally simple - no Redis dependency for now.
 *   On Render, a restart clears the cache, which is acceptable because the
 *   network client will get a timeout and can safely retry.
 *
 * Scope:
 *   Keys are scoped per authenticated user (req.user.id).
 *   Unauthenticated requests (no req.user) are still protected using the
 *   client IP address as a fallback scope key.
 */

const crypto = require('crypto');

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_KEY_LENGTH = 200;

// Map<scopedKey, { status: 'processing'|'done', fingerprint, statusCode, body, expiresAt }>
const store = new Map();

function requestFingerprint(req) {
  const canonical = JSON.stringify({
    method: req.method,
    path: String(req.originalUrl || req.url || '').split('?')[0],
    body: req.body || null
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/** Purge expired entries to prevent unbounded memory growth. */
function purgeExpired() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
}

// Run purge every hour - lightweight, no setInterval leak risk in single-process.
setInterval(purgeExpired, 60 * 60 * 1000).unref();

/**
 * Build the Express middleware.
 *
 * @returns {import('express').RequestHandler}
 */
function idempotency() {
  return (req, res, next) => {
    const idempotencyKey = req.get('Idempotency-Key');

    // No key -> skip idempotency handling entirely.
    if (!idempotencyKey || idempotencyKey.trim() === '') {
      return next();
    }

    const normalizedKey = idempotencyKey.trim();
    if (normalizedKey.length > MAX_KEY_LENGTH) {
      return res.status(400).json({ error: `Idempotency-Key must be ${MAX_KEY_LENGTH} characters or fewer` });
    }

    // Scope the key to the tenant and user (or IP for unauthenticated routes).
    const scope = `${req.tenantId || req.user?.tenantId || 'single-store'}:${req.user?.id || req.ip || 'anon'}`;
    const scopedKey = `${scope}:${normalizedKey}`;
    const fingerprint = requestFingerprint(req);

    const cached = store.get(scopedKey);

    if (cached) {
      if (cached.fingerprint !== fingerprint) {
        return res.status(409).json({
          error: 'This Idempotency-Key was already used for a different request.'
        });
      }
      if (cached.status === 'processing') {
        return res.status(409).json({
          error: 'A request with this Idempotency-Key is still processing. Wait and retry.'
        });
      }

      // Replay the stored response.
      res.setHeader('Idempotency-Replayed', 'true');
      return res.status(cached.statusCode).json(cached.body);
    }

    // Mark this key as in-flight.
    store.set(scopedKey, {
      status: 'processing',
      fingerprint,
      expiresAt: Date.now() + IDEMPOTENCY_TTL_MS
    });

    // Intercept res.json to capture the response before it's sent.
    const originalJson = res.json.bind(res);
    res.json = function interceptJson(payload) {
      // Only cache successful (2xx) responses.
      if (res.statusCode >= 200 && res.statusCode < 300) {
        store.set(scopedKey, {
          status: 'done',
          fingerprint,
          statusCode: res.statusCode,
          body: payload,
          expiresAt: Date.now() + IDEMPOTENCY_TTL_MS
        });
      } else {
        // Error responses should not be replayed - remove the in-flight marker.
        store.delete(scopedKey);
      }

      return originalJson(payload);
    };

    return next();
  };
}

/** Exposed for tests - allow inspecting/clearing the store. */
function _clearStore() {
  store.clear();
}

module.exports = { idempotency, _clearStore };
