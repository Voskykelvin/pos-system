require('dotenv').config();
const fs = require('fs');
const logger = require('./utils/logger');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { sequelize, isUsingMemoryDatabase } = require('./models');
const { startEtimsScheduler } = require('./services/etimsScheduler');
const { seedDemoData } = require('./services/demoSeed');
const { bootstrapSuperAdmin } = require('./services/superAdminBootstrap');
const siteMap = require('./utils/siteMap');
const { authenticate } = require('./middleware/auth');
const { getPlan } = require('./utils/planCatalog');
const { resolveBillingStatus } = require('./services/subscriptionBilling');

// Routes require the route files after app and limiter are configured.
const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const productRoutes = require('./routes/products');
const adminProductRoutes = require('./routes/adminProducts');
const adminCategoryRoutes = require('./routes/adminCategories');
const adminPromotionRoutes = require('./routes/adminPromotions');
const reportRoutes = require('./routes/reports');
const mpesaRoutes = require('./routes/mpesa');
const shiftRoutes = require('./routes/shifts');
const etimsRoutes = require('./routes/etims');
const auditLogsRoutes = require('./routes/auditLogs');
const customerRoutes = require('./routes/customers');
const promotionRoutes = require('./routes/promotions');
const supplierRoutes = require('./routes/suppliers');
const purchaseOrderRoutes = require('./routes/purchaseOrders');
const storeAdminRoutes = require('./routes/storeAdmin');
const { tenantApiLimiter } = require('./middleware/tenantRateLimit');
const tenantRoutes = require('./routes/tenants');
const billingRoutes = require('./routes/billing');

const compression = require('compression');
const { requestIdMiddleware } = require('./middleware/requestId');
const { responseTimeMiddleware } = require('./middleware/responseTime');

const app = express();

app.use(requestIdMiddleware);
app.use(responseTimeMiddleware);
app.use(compression());
app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"], // Vite injects inline scripts in dev
      styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc:     ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com", 'data:']
    }
  },
  crossOriginEmbedderPolicy: false // required when serving Vite on same origin
}));

// Rate limiting
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
app.get('/api/health', async (req, res) => {
  const start = process.hrtime();
  let dbOk = false;
  let dbLatencyMs = null;

  try {
    await sequelize.authenticate();
    const diff = process.hrtime(start);
    dbLatencyMs = Number((diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2));
    dbOk = true;
  } catch (err) {
    logger.error('Health check database check failed', err);
  }

  const memory = process.memoryUsage();

  res.status(dbOk ? 200 : 500).json({
    ok: dbOk,
    database: {
      status: dbOk ? 'healthy' : 'unhealthy',
      type: isUsingMemoryDatabase() ? 'memory' : 'postgres',
      latencyMs: dbLatencyMs
    },
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMb: {
        rss: Math.round(memory.rss / 1024 / 1024),
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024)
      }
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/site-map', (req, res) => {
  res.json(siteMap);
});

app.get('/api/bootstrap', authenticate, async (req, res) => {
  if (req.tenant) {
    const { isExpired } = require('./services/subscriptionBilling');
    if (req.tenant.status === 'active' && isExpired(req.tenant)) {
      const { Tenant } = require('./models');
      await Tenant.update({ status: 'past_due' }, { where: { id: req.tenant.id } }).catch(() => {});
      req.tenant.status = 'past_due';
    }
  }

  const tenantPlan = req.tenant?.plan ? getPlan(req.tenant.plan) : null;
  const billingStatus = resolveBillingStatus(req.tenant);
  res.json({
    userId: req.user.id,
    cashierId: req.user.id,
    user: req.user,
    tenant: req.tenant ? {
      ...req.tenant,
      status: billingStatus,
      enabledFeatures: tenantPlan?.enabledFeatures || []
    } : null,
    demoMode: isUsingMemoryDatabase()
  });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api', apiLimiter);
app.use('/api', tenantApiLimiter);
app.use('/api/billing', billingRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin/products', adminProductRoutes);
app.use('/api/admin/categories', adminCategoryRoutes);
app.use('/api/admin/promotions', adminPromotionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/etims', etimsRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/admin/store', storeAdminRoutes);
app.use('/api', tenantRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');

if (fs.existsSync(indexPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(indexPath);
  });
} else {
  // No built frontend -- return 404 for non-API requests so the error is
  // clear during development when running only the API server.
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Unhandled error', err);
  
  // Only trigger webhook alerts for internal server errors (500+)
  const status = err.status || 500;
  if (status >= 500) {
    const { sendErrorAlert } = require('./services/alertService');
    sendErrorAlert(err, {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      userId: req.userId || null,
      tenantId: req.tenantId || null
    }).catch(() => {});
  }

  res.status(status).json({
    error: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

async function start({ port = PORT, host = HOST } = {}) {
  await sequelize.authenticate();
  logger.info(`Database connection established (${isUsingMemoryDatabase() ? 'memory demo' : 'postgres'})`);

  if (isUsingMemoryDatabase()) {
    try {
      await sequelize.drop();
    } catch { /* ignore drop errors */ }
    await sequelize.sync({ force: true });
    await seedDemoData();
    logger.info('Demo data loaded');
  } else if (process.env.DB_SYNC === 'true') {
    // Run pending SQL migrations instead of the unsafe alter:true sync.
    // This preserves existing data and applies only incremental changes.
    const { runMigrations } = require('./scripts/migrate-inline');
    await runMigrations(sequelize);
    if (process.env.SEED_DEMO_DATA === 'true') {
      await seedDemoData();
      logger.info('Demo data loaded into configured database');
    }
  }

  await bootstrapSuperAdmin();

  if (process.env.ENABLE_ETIMS_SCHEDULER === 'true') {
    startEtimsScheduler();
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      logger.info(`Jijenge POS listening on port ${actualPort}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

if (require.main === module) {
  start().catch((err) => {
    logger.error('Failed to start Jijenge POS', err);
    process.exit(1);
  });
}

module.exports = { app, start };
