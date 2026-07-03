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

  const latestOrder = await Order.findOne({
    where: {
      createdAt: { [Op.gte]: start },
      orderNumber: { [Op.like]: `SUP-${datePart}-%` }
    },
    order: [['orderNumber', 'DESC']]
  });

  const latestSequence = latestOrder
    ? Number(latestOrder.orderNumber.split('-').pop())
    : 0;
  const sequence = String(latestSequence + 1).padStart(4, '0');
  return `SUP-${datePart}-${sequence}`;
}

module.exports = { generateOrderNumber };
