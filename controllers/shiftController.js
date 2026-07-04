const { Op } = require('sequelize');
const { Shift, Payment, Order, User, Expense } = require('../models');
const { logAudit } = require('../services/auditLogger');
const { tenantWhere } = require('../utils/tenantScope');

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

  const expectedCashSales = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const totalExpenses = shift.totalExpenses || 0;
  return expectedCashSales - totalExpenses;
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
    note: shift.note,
    totalExpenses: Number(shift.totalExpenses || 0)
  };
}

async function current(req, res) {
  try {
    const cashierId = req.query.cashierId && ['admin', 'manager'].includes(req.user.role)
      ? req.query.cashierId
      : req.user.id;

    const shift = await Shift.findOne({
      where: tenantWhere(req, { cashierId, status: 'open' }),
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
      where: tenantWhere(req, { cashierId: req.user.id, status: 'open' })
    });
    if (existing) {
      return res.status(409).json({ error: 'This cashier already has an open shift' });
    }

    const shift = await Shift.create({
      cashierId: req.user.id,
      openedByUserId: req.user.id,
      openingFloat,
      note,
      tenantId: req.tenantId || null
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
      where: tenantWhere(req),
      include: [{ model: User, as: 'cashier', attributes: ['id', 'name'] }],
      order: [['openedAt', 'DESC']],
      limit: 50
    });
    res.json(shifts.map((shift) => mapShift(shift)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/shifts/summary?date=2026-07-04
 * Manager/admin view: all shifts for a given business date across all cashiers.
 * Aggregates cash variance and sales totals.
 */
async function summary(req, res) {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const start = new Date(dateStr + 'T00:00:00.000Z');
    const end   = new Date(dateStr + 'T23:59:59.999Z');

    if (isNaN(start.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const shifts = await Shift.findAll({
      where: {
        ...tenantWhere(req),
        openedAt: { [Op.between]: [start, end] }
      },
      include: [{ model: User, as: 'cashier', attributes: ['id', 'name'] }],
      order: [['openedAt', 'ASC']]
    });

    // Compute expected cash for each open shift live
    const enriched = await Promise.all(shifts.map(async (shift) => {
      const expectedCash = shift.status === 'open'
        ? await expectedCashForShift(shift)
        : Number(shift.cashSalesExpected);
      return mapShift(shift, expectedCash);
    }));

    const totals = enriched.reduce((acc, s) => ({
      totalFloats:        acc.totalFloats        + (s.openingFloat || 0),
      totalExpectedCash:  acc.totalExpectedCash  + (s.cashSalesExpected || s.currentCashSalesExpected || 0),
      totalCashCounted:   acc.totalCashCounted   + (s.cashCounted || 0),
      totalVariance:      acc.totalVariance      + (s.cashVariance || 0)
    }), { totalFloats: 0, totalExpectedCash: 0, totalCashCounted: 0, totalVariance: 0 });

    return res.json({ date: dateStr, shifts: enriched, totals: {
      totalFloats:       money(totals.totalFloats),
      totalExpectedCash: money(totals.totalExpectedCash),
      totalCashCounted:  money(totals.totalCashCounted),
      totalVariance:     money(totals.totalVariance)
    }});
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function addExpense(req, res) {
  const { amount, category, description } = req.body;
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Valid expense amount is required' });
  }

  const shift = await Shift.findOne({
    where: tenantWhere(req, { cashierId: req.user.id, status: 'open' })
  });

  if (!shift) {
    return res.status(400).json({ error: 'No open shift found to log expense against' });
  }

  try {
    const expense = await Expense.create({
      amount,
      category,
      description,
      shiftId: shift.id,
      cashierId: req.user.id,
      tenantId: req.tenantId || null
    });

    const newTotalExpenses = Number(shift.totalExpenses) + Number(amount);
    await shift.update({ totalExpenses: newTotalExpenses });

    await logAudit({
      req,
      action: 'shift.expense',
      entityType: 'shift',
      entityId: shift.id,
      metadata: { amount, category, description }
    });

    return res.status(201).json(expense);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { closeShift, current, list, openShift, summary, addExpense };
