import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { constantTimeTokenMatch } = require('./secureToken');

describe('constant-time secret comparison', () => {
  it('accepts only an exact non-empty token', () => {
    expect(constantTimeTokenMatch('secret-token', 'secret-token')).toBe(true);
    expect(constantTimeTokenMatch('secret-token', 'secret-taken')).toBe(false);
    expect(constantTimeTokenMatch('secret-token', 'short')).toBe(false);
    expect(constantTimeTokenMatch('', '')).toBe(false);
  });
});
