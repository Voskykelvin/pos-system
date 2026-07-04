'use strict';

const { Promotion } = require('../models');
const { logAudit } = require('../services/auditLogger');
const { tenantWhere, withTenant } = require('../utils/tenantScope');

/**
 * GET /api/promotions/validate?code=SAVE10&orderTotal=5000
 * Public endpoint - cashier types code, returns discount amount or error.
 */
async function validate(req, res) {
  const code = (req.query.code || '').trim().toUpperCase();
  const orderTotal = Number(req.query.orderTotal || 0);

  if (!code) return res.status(400).json({ error: 'code is required' });

  try {
    const promo = await Promotion.findOne({
      where: tenantWhere(req, { code, isActive: true })
    });

    if (!promo) {
      return res.status(404).json({ error: 'Promo code not found or inactive' });
    }

    const now = new Date();

    if (promo.startsAt && now < new Date(promo.startsAt)) {
      return res.status(400).json({ error: 'This promotion has not started yet' });
    }
    if (promo.expiresAt && now > new Date(promo.expiresAt)) {
      return res.status(400).json({ error: 'This promotion has expired' });
    }
    if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
      return res.status(400).json({ error: 'This promotion has reached its maximum uses' });
    }
    if (orderTotal > 0 && Number(promo.minOrderTotal) > orderTotal) {
      return res.status(400).json({
        error: `This promotion requires a minimum order of KES ${Number(promo.minOrderTotal).toFixed(2)}`
      });
    }

    const discountAmount = promo.type === 'percent'
      ? Math.min(orderTotal * (Number(promo.value) / 100), orderTotal)
      : Math.min(Number(promo.value), orderTotal);

    return res.json({
      valid: true,
      promotionId: promo.id,
      code: promo.code,
      description: promo.description,
      type: promo.type,
      value: Number(promo.value),
      discountAmount: Number(discountAmount.toFixed(2))
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/admin/promotions
 */
async function list(req, res) {
  try {
    const promos = await Promotion.findAll({
      where: tenantWhere(req),
      order: [['createdAt', 'DESC']]
    });
    return res.json(promos.map(mapPromo));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/admin/promotions
 */
async function create(req, res) {
  const { code, description, type, value, minOrderTotal, maxUses, startsAt, expiresAt } = req.body;

  if (!code || !type || value === undefined) {
    return res.status(400).json({ error: 'code, type, and value are required' });
  }

  try {
    const promo = await Promotion.create({
      code: String(code).trim().toUpperCase(),
      description: description || null,
      type,
      value,
      minOrderTotal: minOrderTotal || 0,
      maxUses: maxUses || 0,
      startsAt: startsAt || null,
      expiresAt: expiresAt || null,
      createdByUserId: req.user?.id || null,
      ...withTenant(req)
    });

    await logAudit({
      req,
      action: 'promotion.create',
      entityType: 'promotion',
      entityId: promo.id,
      metadata: { code: promo.code, type: promo.type, value: Number(promo.value) }
    });

    return res.status(201).json(mapPromo(promo));
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'A promotion with that code already exists' });
    }
    return res.status(400).json({ error: err.message });
  }
}

/**
 * PUT /api/admin/promotions/:id
 */
async function update(req, res) {
  try {
    const promo = await Promotion.findByPk(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Promotion not found' });

    const { description, type, value, minOrderTotal, maxUses, startsAt, expiresAt, isActive } = req.body;
    await promo.update({ description, type, value, minOrderTotal, maxUses, startsAt, expiresAt, isActive });

    await logAudit({
      req,
      action: 'promotion.update',
      entityType: 'promotion',
      entityId: promo.id,
      metadata: { code: promo.code }
    });

    return res.json(mapPromo(promo));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

function mapPromo(p) {
  return {
    id: p.id,
    code: p.code,
    description: p.description,
    type: p.type,
    value: Number(p.value),
    minOrderTotal: Number(p.minOrderTotal),
    maxUses: p.maxUses,
    usedCount: p.usedCount,
    startsAt: p.startsAt,
    expiresAt: p.expiresAt,
    isActive: p.isActive,
    createdAt: p.createdAt
  };
}

module.exports = { create, list, update, validate };
