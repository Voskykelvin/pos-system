const { User } = require('../models');
const { verifyPassword } = require('../utils/passwords');

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
  const normalized = identifier.toLowerCase();
  const users = await User.findAll({ where: { isActive: true } });
  const approver = users.find(
    (candidate) =>
      candidate.email?.toLowerCase() === normalized ||
      candidate.phone === identifier
  );

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
