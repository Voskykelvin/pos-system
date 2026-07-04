require('dotenv').config();

const { sequelize, User } = require('../models');
const { hashPassword } = require('../utils/passwords');

async function main() {
  const role = process.env.ADMIN_ROLE || 'admin';
  const allowedRoles = new Set(['super_admin', 'admin', 'manager', 'cashier']);
  if (!allowedRoles.has(role)) {
    throw new Error(`ADMIN_ROLE must be one of: ${Array.from(allowedRoles).join(', ')}`);
  }

  const {
    ADMIN_NAME = role === 'super_admin'
      ? process.env.SUPER_ADMIN_NAME || 'Kelvin O.'
      : 'Store Admin',
    ADMIN_EMAIL = role === 'super_admin' ? process.env.SUPER_ADMIN_EMAIL : undefined,
    ADMIN_PHONE,
    ADMIN_PASSWORD = role === 'super_admin' ? process.env.SUPER_ADMIN_PASSWORD : undefined
  } = process.env;

  if (!ADMIN_EMAIL && !ADMIN_PHONE) {
    throw new Error('ADMIN_EMAIL or ADMIN_PHONE is required');
  }
  if (!ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD is required');
  }

  await sequelize.authenticate();
  const existing = await User.findOne({
    where: ADMIN_EMAIL ? { email: ADMIN_EMAIL } : { phone: ADMIN_PHONE }
  });

  if (existing) {
    await existing.update({
      name: ADMIN_NAME,
      passwordHash: hashPassword(ADMIN_PASSWORD),
      role,
      isActive: true
    });
    console.log(`Updated ${role} user ${existing.id}`);
    return;
  }

  const user = await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL || null,
    phone: ADMIN_PHONE || null,
    passwordHash: hashPassword(ADMIN_PASSWORD),
    role,
    isActive: true
  });

  console.log(`Created ${role} user ${user.id}`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  })
  .finally(async () => {
    await sequelize.close();
  });
