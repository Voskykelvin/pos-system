'use strict';

const { Tenant } = require('../models');

/**
 * Multi-Tenant Context Middleware
 *
 * Attaches req.tenantId and req.tenant to every authenticated request.
 * Allows super_admin to override tenant via X-Tenant-Id header.
 */
async function resolveTenant(req, res, next) {
  try {
    // 1. If super_admin, allow tenant override via header X-Tenant-Id
    if (req.user?.role === 'super_admin') {
      const headerTenantId = req.headers['x-tenant-id'];
      if (headerTenantId) {
        req.tenantId = headerTenantId;
        return next();
      }
    }

    // 2. Extract tenantId from user session / token
    const tenantId = req.user?.tenantId;
    if (tenantId) {
      req.tenantId = tenantId;
    }

    next();
  } catch (err) {
    return res.status(500).json({ error: 'Tenant context resolution error: ' + err.message });
  }
}

module.exports = { resolveTenant };
