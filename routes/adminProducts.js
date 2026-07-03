const express = require('express');
const router = express.Router();
const {
  list, create, update, deactivate, adjustStock, lowStock
} = require('../controllers/productAdminController');

router.get('/', list);
router.get('/low-stock', lowStock);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', deactivate);
router.post('/:id/adjust-stock', adjustStock);

module.exports = router;
