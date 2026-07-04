require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { sequelize, isUsingMemoryDatabase } = require('./models');
const { startEtimsScheduler } = require('./services/etimsScheduler');
const { seedDemoData } = require('./services/demoSeed');
const siteMap = require('./utils/siteMap');
const { authenticate } = require('./middleware/auth');

// Routes — require the route files after app + limiter are configured
const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const productRoutes = require('./routes/products');
const adminProductRoutes = require('./routes/adminProducts');
const adminCategoryRoutes = require('./routes/adminCategories');
const reportRoutes = require('./routes/reports');
const mpesaRoutes = require('./routes/mpesa');
const shiftRoutes = require('./routes/shifts');
const etimsRoutes = require('./routes/etims');
const auditLogsRoutes = require('./routes/auditLogs');
const customerRoutes = require('./routes/customers');
const promotionRoutes = require('./routes/promotions');
const supplierRoutes = require('./routes/suppliers');
const purchaseOrderRoutes = require('./routes/purchaseOrders');
const tenantRoutes = require('./routes/tenants');

const app = express();

// ── Security headers ───────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"], // Vite injects inline scripts in dev
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc:    ["'self'", 'data:']
    }
  },
  crossOriginEmbedderPolicy: false // required when serving Vite on same origin
}));

// ── Rate limiting ───────────────────────────────────────────────────
// Auth brute-force protection: 10 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              10,
  standardHeaders: 'draft-7',
  legacyHeaders:    false,
  message:          { error: 'Too many login attempts. Try again in 15 minutes.' }
});

// General API limit: 120 requests per minute per IP (generous, prevents runaway loops)
const apiLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              120,
  standardHeaders: 'draft-7',
  legacyHeaders:    false,
  message:          { error: 'Too many requests. Slow down.' }
});
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

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api', apiLimiter);
app.use('/api/orders', orderRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin/products', adminProductRoutes);
app.use('/api/admin/categories', adminCategoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/etims', etimsRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api', tenantRoutes);

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
    try {
      await sequelize.drop();
    } catch { /* ignore drop errors */ }
    await sequelize.sync({ force: true });
    await seedDemoData();
    console.log('Demo data loaded');
  } else if (process.env.DB_SYNC === 'true') {
    // Run pending SQL migrations instead of the unsafe alter:true sync.
    // This preserves existing data and applies only incremental changes.
    const { runMigrations } = require('./scripts/migrate-inline');
    await runMigrations(sequelize);
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
