'use strict';

const { Op } = require('sequelize');
const { sequelize, Customer, LoyaltyTransaction } = require('../models');
const { logAudit } = require('../services/auditLogger');

/**
 * GET /api/customers/search?q=0712345678
 * Searches by phone or name. Returns up to 10 matches with loyalty balance.
 */
async function search(req, res) {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  try {
    const customers = await Customer.findAll({
      where: {
        [Op.or]: [
          { phone: { [Op.iLike]: `%${q}%` } },
          { name:  { [Op.iLike]: `%${q}%` } }
        ]
      },
      limit: 10,
      order: [['name', 'ASC']]
    });

    return res.json(customers.map(mapCustomer));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/customers/:id
 */
async function getOne(req, res) {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    return res.json(mapCustomer(customer));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/customers
 * Body: { name, phone, kraPin }
 * Creates a new customer — called from Checkout when cashier taps "Add as new customer".
 */
async function create(req, res) {
  const { name, phone, kraPin } = req.body;

  if (!phone && !name) {
    return res.status(400).json({ error: 'At least a name or phone number is required' });
  }

  try {
    const customer = await Customer.create({
      name:   name   ? String(name).trim()   : null,
      phone:  phone  ? String(phone).trim()  : null,
      kraPin: kraPin ? String(kraPin).trim() : null,
      loyaltyPoints: 0
    });

    await logAudit({
      req,
      action: 'customer.create',
      entityType: 'customer',
      entityId: customer.id,
      metadata: { name: customer.name, phone: customer.phone }
    });

    return res.status(201).json(mapCustomer(customer));
  } catch (err) {
    // Unique constraint on phone
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'A customer with that phone number already exists' });
    }
    return res.status(400).json({ error: err.message });
  }
}

/**
 * GET /api/customers/:id/loyalty
 * Returns the loyalty balance and last 20 transactions.
 */
async function loyaltyBalance(req, res) {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const transactions = await LoyaltyTransaction.findAll({
      where: { customerId: customer.id },
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    return res.json({
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone,
      loyaltyPoints: customer.loyaltyPoints,
      // KES value of points (100 points = KES 1 default)
      redemptionValue: Math.floor(customer.loyaltyPoints / (Number(process.env.LOYALTY_POINTS_PER_KES) || 100)),
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        points: t.points,
        balanceBefore: t.balanceBefore,
        balanceAfter: t.balanceAfter,
        note: t.note,
        createdAt: t.createdAt
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function mapCustomer(c) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    kraPin: c.kraPin,
    loyaltyPoints: c.loyaltyPoints || 0
  };
}

module.exports = { create, getOne, loyaltyBalance, search };
