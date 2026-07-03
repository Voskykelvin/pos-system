require('dotenv').config();

const { sequelize, User } = require('../models');
const { hashPassword } = require('../utils/passwords');

async function main() {
  const {
    ADMIN_NAME = 'Store Admin',
    ADMIN_EMAIL,
    ADMIN_PHONE,
    ADMIN_PASSWORD
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
      role: 'admin',
      isActive: true
    });
    console.log(`Updated admin user ${existing.id}`);
    return;
  }

  const user = await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL || null,
    phone: ADMIN_PHONE || null,
    passwordHash: hashPassword(ADMIN_PASSWORD),
    role: 'admin',
    isActive: true
  });

  console.log(`Created admin user ${user.id}`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  })
  .finally(async () => {
    await sequelize.close();
  });
