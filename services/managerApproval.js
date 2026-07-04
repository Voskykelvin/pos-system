const { Op } = require('sequelize');
const { User } = require('../models');
const { verifyPassword } = require('../utils/passwords');
const { tenantWhere } = require('../utils/tenantScope');

function isManagerRole(role) {
  return role === 'admin' || role === 'manager';
}

async function resolveManagerApproval(req, { reason }) {
  if (isManagerRole(req.user?.role)) {
    return {
      approvedByUserId: req.user.id,
      approvedByRole: req.user.role,
      selfApproved: true
    };
  }

  const approval = req.body?.managerApproval;
  if (!approval?.identifier || !approval?.password) {
    const detail = reason ? ` for ${reason}` : '';
    const err = new Error(`Manager approval is required${detail}`);
    err.status = 403;
    throw err;
  }

  const identifier = approval.identifier.trim();
  const approver = await User.findOne({
    where: tenantWhere(req, {
      isActive: true,
      [Op.or]: [{ email: { [Op.iLike]: identifier } }, { phone: identifier }]
    })
  });

  if (!approver || !isManagerRole(approver.role) || !verifyPassword(approval.password, approver.passwordHash)) {
    const err = new Error('Invalid manager approval');
    err.status = 403;
    throw err;
  }

  return {
    approvedByUserId: approver.id,
    approvedByRole: approver.role,
    selfApproved: false
  };
}

module.exports = { resolveManagerApproval };
