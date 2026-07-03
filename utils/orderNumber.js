const { Order } = require('../models');
const { Op } = require('sequelize');
const { getBusinessDate, getBusinessDayRange } = require('./businessTime');

/**
 * Generates a receipt-friendly order number like SUP-20260703-0001.
 * Resets the counter each business day.
 */
async function generateOrderNumber() {
  const now = new Date();
  const datePart = getBusinessDate(now).compact;
  const { start } = getBusinessDayRange(now);

  const countToday = await Order.count({
    where: {
      createdAt: { [Op.gte]: start }
    }
  });

  const sequence = String(countToday + 1).padStart(4, '0');
  return `SUP-${datePart}-${sequence}`;
}

module.exports = { generateOrderNumber };
