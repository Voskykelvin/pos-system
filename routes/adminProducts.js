const express = require('express');
const router = express.Router();
const { authenticate, requireRoles } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const {
  list, create, update, deactivate, adjustStock, lowStock
} = require('../controllers/productAdminController');
const { exportCatalogCsv, importCatalogCsv } = require('../controllers/csvController');

router.use(authenticate);

router.get('/', requireRoles('admin', 'manager'), list);
router.get('/low-stock', requireRoles('admin', 'manager'), lowStock);
router.get('/export-csv', requireRoles('admin', 'manager'), exportCatalogCsv);
router.post('/import-csv', requireRoles('admin', 'manager'), importCatalogCsv);
router.post('/', requireRoles('admin', 'manager'), validate(schemas.createProduct), create);
router.put('/:id', requireRoles('admin', 'manager'), validate(schemas.updateProduct), update);
router.delete('/:id', requireRoles('admin', 'manager'), deactivate);
router.post(
  '/:id/adjust-stock',
  requireRoles('admin', 'manager', 'cashier'),
  validate(schemas.adjustStock),
  adjustStock
);

module.exports = router;
