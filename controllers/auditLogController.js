const { AuditLog, User } = require('../models');

function mapAuditLog(row) {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: row.metadata,
    ipAddress: row.ipAddress,
    createdAt: row.createdAt,
    actor: row.actor ? {
      id: row.actor.id,
      name: row.actor.name,
      role: row.actor.role
    } : null,
    approver: row.approver ? {
      id: row.approver.id,
      name: row.approver.name,
      role: row.approver.role
    } : null
  };
}

async function list(req, res) {
  const requestedLimit = Number(req.query.limit || 50);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 50;

  try {
    const rows = await AuditLog.findAll({
      include: [
        { model: User, as: 'actor', attributes: ['id', 'name', 'role'] },
        { model: User, as: 'approver', attributes: ['id', 'name', 'role'] }
      ],
      order: [['createdAt', 'DESC']],
      limit
    });

    res.json(rows.map(mapAuditLog));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { list };
