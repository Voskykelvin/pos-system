'use strict';

function tenantWhere(req, base = {}) {
  return req.tenantId ? { ...base, tenantId: req.tenantId } : base;
}

function withTenant(req, values = {}) {
  return req.tenantId ? { ...values, tenantId: req.tenantId } : values;
}

module.exports = { tenantWhere, withTenant };
