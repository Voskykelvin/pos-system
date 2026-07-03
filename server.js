require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { sequelize, isUsingMemoryDatabase } = require('./models');
const { startEtimsScheduler } = require('./services/etimsScheduler');
const { seedDemoData } = require('./services/demoSeed');
const siteMap = require('./utils/siteMap');
const { authenticate } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const ordersRoutes = require('./routes/orders');
const mpesaRoutes = require('./routes/mpesa');
const etimsRoutes = require('./routes/etims');
const productsRoutes = require('./routes/products');
const adminProductsRoutes = require('./routes/adminProducts');
const adminCategoriesRoutes = require('./routes/adminCategories');
const reportsRoutes = require('./routes/reports');
const shiftsRoutes = require('./routes/shifts');
const auditLogsRoutes = require('./routes/auditLogs');

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    database: isUsingMemoryDatabase() ? 'memory' : 'postgres',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/site-map', (req, res) => {
  res.json(siteMap);
});

app.get('/api/bootstrap', authenticate, async (req, res) => {
  res.json({
    userId: req.user.id,
    cashierId: req.user.id,
    user: req.user,
    demoMode: isUsingMemoryDatabase()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/etims', etimsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/admin/products', adminProductsRoutes);
app.use('/api/admin/categories', adminCategoriesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/audit-logs', auditLogsRoutes);

const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');

if (fs.existsSync(indexPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(indexPath);
  });
}

const PORT = process.env.PORT || 4000;

async function start({ port = PORT } = {}) {
  await sequelize.authenticate();
  console.log(`Database connection established (${isUsingMemoryDatabase() ? 'memory demo' : 'postgres'})`);

  if (isUsingMemoryDatabase()) {
    await sequelize.sync({ force: true });
    await seedDemoData();
    console.log('Demo data loaded');
  } else if (process.env.DB_SYNC === 'true') {
    await sequelize.sync({ alter: true });
    if (process.env.SEED_DEMO_DATA === 'true') {
      await seedDemoData();
      console.log('Demo data loaded into configured database');
    }
  }

  if (process.env.ENABLE_ETIMS_SCHEDULER === 'true') {
    startEtimsScheduler();
  }

  return app.listen(port, () => {
    console.log(`POS app listening on port ${port}`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start POS app:', err);
    process.exit(1);
  });
}

module.exports = { app, start };
