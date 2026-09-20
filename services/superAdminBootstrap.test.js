import { describe, expect, it } from 'vitest';
import superAdminBootstrap from './superAdminBootstrap';

const { resolveSuperAdminCredentials } = superAdminBootstrap;

describe('super admin bootstrap', () => {
  it('uses safe platform-owner defaults when no environment variables are set', () => {
    const previous = {
      SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL,
      SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD,
      SUPER_ADMIN_NAME: process.env.SUPER_ADMIN_NAME
    };

    try {
      delete process.env.SUPER_ADMIN_EMAIL;
      delete process.env.SUPER_ADMIN_PASSWORD;
      delete process.env.SUPER_ADMIN_NAME;

      const credentials = resolveSuperAdminCredentials();

      expect(credentials.email).toBe('superadmin@example.local');
      expect(credentials.password).toBe('superadmin12345');
      expect(credentials.name).toBe('Platform Owner');
    } finally {
      Object.entries(previous).forEach(([key, value]) => {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      });
    }
  });
});
