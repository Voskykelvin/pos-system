require('dotenv').config();

const { sequelize, isUsingMemoryDatabase } = require('../models');

async function main() {
  if (isUsingMemoryDatabase()) {
    throw new Error('DATABASE_URL is required for db:sync');
  }

  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  console.log('Database schema synced');
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  })
  .finally(async () => {
    await sequelize.close();
  });
