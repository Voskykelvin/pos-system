const { Op } = require('sequelize');
const { Shift, Payment, Order, User } = require('../models');
const { logAudit } = require('../services/auditLogger');

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

async function expectedCashForShift(shift, closedAt = new Date()) {
  const payments = await Payment.findAll({
    where: {
      method: 'cash',
      status: 'confirmed',
      createdAt: {
        [Op.gte]: shift.openedAt,
        [Op.lte]: closedAt
      }
    },
    include: [{
      model: Order,
      where: {
        cashierId: shift.cashierId,
        status: 'completed'
      }
    }]
  });

  return payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
}

function mapShift(shift, expectedCash = null) {
  return {
    id: shift.id,
    cashierId: shift.cashierId,
    cashier: shift.cashier?.name || null,
    status: shift.status,
    openingFloat: Number(shift.openingFloat),
    cashSalesExpected: Number(shift.cashSalesExpected),
    currentCashSalesExpected: expectedCash === null ? undefined : money(expectedCash),
    cashCounted: shift.cashCounted === null ? null : Number(shift.cashCounted),
    cashVariance: shift.cashVariance === null ? null : Number(shift.cashVariance),
    openedAt: shift.openedAt,
    closedAt: shift.closedAt,
    note: shift.note
  };
}

async function current(req, res) {
  try {
    const cashierId = req.query.cashierId && ['admin', 'manager'].includes(req.user.role)
      ? req.query.cashierId
      : req.user.id;

    const shift = await Shift.findOne({
      where: { cashierId, status: 'open' },
      include: [{ model: User, as: 'cashier', attributes: ['id', 'name'] }],
      order: [['openedAt', 'DESC']]
    });

    if (!shift) return res.json(null);

    const expectedCash = await expectedCashForShift(shift);
    return res.json(mapShift(shift, expectedCash));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function openShift(req, res) {
  const openingFloat = Number(req.body.openingFloat || 0);
  const note = req.body.note || null;

  if (openingFloat < 0) {
    return res.status(400).json({ error: 'openingFloat cannot be negative' });
  }

  try {
    const existing = await Shift.findOne({
      where: { cashierId: req.user.id, status: 'open' }
    });
    if (existing) {
      return res.status(409).json({ error: 'This cashier already has an open shift' });
    }

    const shift = await Shift.create({
      cashierId: req.user.id,
      openedByUserId: req.user.id,
      openingFloat,
      note
    });

    await logAudit({
      req,
      action: 'shift.open',
      entityType: 'shift',
      entityId: shift.id,
      metadata: { openingFloat, note }
    });

    return res.status(201).json(mapShift(shift, 0));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function closeShift(req, res) {
  const { id } = req.params;
  const cashCounted = Number(req.body.cashCounted);
  const note = req.body.note || null;

  if (Number.isNaN(cashCounted) || cashCounted < 0) {
    return res.status(400).json({ error: 'cashCounted must be a non-negative number' });
  }

  try {
    const shift = await Shift.findByPk(id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    if (shift.status !== 'open') {
      return res.status(400).json({ error: 'Shift is already closed' });
    }
    if (shift.cashierId !== req.user.id && !['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only the cashier or a manager can close this shift' });
    }

    const closedAt = new Date();
    const cashSalesExpected = await expectedCashForShift(shift, closedAt);
    const expectedDrawer = Number(shift.openingFloat) + cashSalesExpected;
    const cashVariance = cashCounted - expectedDrawer;

    await shift.update({
      status: 'closed',
      closedByUserId: req.user.id,
      cashSalesExpected,
      cashCounted,
      cashVariance,
      closedAt,
      note: note || shift.note
    });

    await logAudit({
      req,
      action: 'shift.close',
      entityType: 'shift',
      entityId: shift.id,
      metadata: {
        openingFloat: Number(shift.openingFloat),
        cashSalesExpected: money(cashSalesExpected),
        cashCounted: money(cashCounted),
        cashVariance: money(cashVariance)
      }
    });

    return res.json(mapShift(shift));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function list(req, res) {
  try {
    const shifts = await Shift.findAll({
      include: [{ model: User, as: 'cashier', attributes: ['id', 'name'] }],
      order: [['openedAt', 'DESC']],
      limit: 50
    });
    res.json(shifts.map((shift) => mapShift(shift)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { closeShift, current, list, openShift };
