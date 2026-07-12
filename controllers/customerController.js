'use strict';

const { Op } = require('sequelize');
const { sequelize, Customer, LoyaltyTransaction } = require('../models');
const { logAudit } = require('../services/auditLogger');
const { tenantWhere, withTenant } = require('../utils/tenantScope');

/**
 * GET /api/customers/search?q=0712345678
 * Searches by phone or name. Returns up to 10 matches with loyalty balance.
 */
async function search(req, res) {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  try {
    const customers = await Customer.findAll({
      where: tenantWhere(req, {
        [Op.or]: [
          { phone: { [Op.iLike]: `%${q}%` } },
          { name:  { [Op.iLike]: `%${q}%` } }
        ]
      }),
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
    const customer = await Customer.findOne({ where: tenantWhere(req, { id: req.params.id }) });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    return res.json(mapCustomer(customer));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/customers
 * Body: { name, phone, kraPin }
 * Creates a new customer - called from Checkout when cashier taps "Add as new customer".
 */
async function create(req, res) {
  const { name, phone, kraPin } = req.body;

  if (!phone && !name) {
    return res.status(400).json({ error: 'At least a name or phone number is required' });
  }

  try {
    const normalizedPhone = phone ? String(phone).trim() : null;
    if (normalizedPhone) {
      const existing = await Customer.findOne({
        where: tenantWhere(req, { phone: normalizedPhone })
      });
      if (existing) {
        return res.status(409).json({ error: 'A customer with that phone number already exists in this store' });
      }
    }

    const customer = await Customer.create({
      name:   name   ? String(name).trim()   : null,
      phone:  normalizedPhone,
      kraPin: kraPin ? String(kraPin).trim() : null,
      loyaltyPoints: 0,
      ...withTenant(req)
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
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/customers/:id/ledger
 * Returns the customer's credit transaction ledger (up to 50 latest).
 */
async function ledger(req, res) {
  try {
    const customer = await Customer.findOne({ where: tenantWhere(req, { id: req.params.id }) });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const { CustomerLedger, StoreCreditTransaction } = require('../models');
    const [transactions, storeCreditTransactions] = await Promise.all([CustomerLedger.findAll({
      where: { customerId: customer.id },
      order: [['createdAt', 'DESC']],
      limit: 50
    }), StoreCreditTransaction.findAll({
      where: { customerId: customer.id },
      order: [['createdAt', 'DESC']],
      limit: 50
    })]);

    return res.json({
      creditLimit: customer.creditLimit,
      creditBalance: customer.creditBalance,
      storeCreditBalance: customer.storeCreditBalance,
      transactions,
      storeCreditTransactions
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/customers/:id/payment
 * Records a payment against the customer's debt.
 */
async function payDebt(req, res) {
  const { amount, notes } = req.body;
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Valid payment amount is required' });
  }

  const t = await sequelize.transaction();
  try {
    const customer = await Customer.findOne({
      where: tenantWhere(req, { id: req.params.id }),
      transaction: t
    });
    if (!customer) throw new Error('Customer not found');

    const paymentAmount = Number(amount);
    const newBalance = Number(customer.creditBalance) - paymentAmount;

    await customer.update({ creditBalance: newBalance }, { transaction: t });

    const { CustomerLedger } = require('../models');
    await CustomerLedger.create({
      customerId: customer.id,
      tenantId: req.tenantId || null,
      orderId: null,
      type: 'payment',
      amount: paymentAmount,
      balanceAfter: newBalance,
      notes: notes || 'Debt repayment'
    }, { transaction: t });

    await logAudit({
      req,
      action: 'customer.debt_payment',
      entityType: 'customer',
      entityId: customer.id,
      metadata: { amount: paymentAmount, newBalance },
      transaction: t
    });

    await t.commit();
    return res.json({ success: true, newBalance });
  } catch (err) {
    await t.rollback();
    return res.status(400).json({ error: err.message });
  }
}

/**
 * GET /api/customers/:id/loyalty
 * Returns the loyalty balance and last 20 transactions.
 */
async function loyaltyBalance(req, res) {
  try {
    const customer = await Customer.findOne({ where: tenantWhere(req, { id: req.params.id }) });
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
    loyaltyPoints: c.loyaltyPoints,
    creditLimit: c.creditLimit,
    creditBalance: c.creditBalance,
    storeCreditBalance: c.storeCreditBalance,
    createdAt: c.createdAt
  };
}

module.exports = { create, getOne, loyaltyBalance, search, ledger, payDebt };
