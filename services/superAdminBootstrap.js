'use strict';

const { User } = require('../models');
const { hashPassword } = require('../utils/passwords');
const logger = require('../utils/logger');

async function bootstrapSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME || 'Platform Owner';

  if (!email || !password) {
    return;
  }

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

module.exports = { bootstrapSuperAdmin };
