const { AuditLog } = require('../models');

async function logAudit({
  req,
  userId,
  approvedByUserId,
  action,
  entityType,
  entityId,
  metadata,
  transaction
}) {
  return AuditLog.create({
    userId: userId || req?.user?.id || null,
    approvedByUserId: approvedByUserId || null,
    action,
    entityType,
    entityId: entityId || null,
    metadata: metadata || null,
    ipAddress: req?.ip || null
  }, { transaction });
}

module.exports = { logAudit };
