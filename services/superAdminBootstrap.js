'use strict';

const { User } = require('../models');
const { hashPassword } = require('../utils/passwords');
const logger = require('../utils/logger');

function resolveSuperAdminCredentials() {
  const email = String(process.env.SUPER_ADMIN_EMAIL || 'superadmin@example.local').trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || 'superadmin12345';
  const name = process.env.SUPER_ADMIN_NAME || 'Platform Owner';

  return { email, password, name };
}

async function bootstrapSuperAdmin() {
  const { email, password, name } = resolveSuperAdminCredentials();
  const normalizedEmail = String(email).trim().toLowerCase();
  const passwordHash = hashPassword(password);
  const existing = await User.findOne({ where: { email: normalizedEmail } });

  if (existing) {
    await existing.update({
      name,
      passwordHash,
      role: 'super_admin',
      tenantId: null,
      isActive: true
    });
    logger.info(`Super admin bootstrap updated ${normalizedEmail}`, { email: normalizedEmail });
    return;
  }

  await User.create({
    name,
    email: normalizedEmail,
    passwordHash,
    role: 'super_admin',
    tenantId: null,
    isActive: true
  });

  logger.info(`Super admin bootstrap created ${normalizedEmail}`, { email: normalizedEmail });
}

module.exports = { bootstrapSuperAdmin, resolveSuperAdminCredentials };
