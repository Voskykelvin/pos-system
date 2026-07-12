const { OrderRefund, OrderRefundItem } = require('../models');

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function allocateTender(payments, refundTotal) {
  const confirmed = (payments || []).filter((payment) => payment.status === 'confirmed');
  const paidTotal = confirmed.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  let allocated = 0;

  return confirmed.map((payment, index) => {
    const amount = index === confirmed.length - 1
      ? roundMoney(refundTotal - allocated)
      : roundMoney(refundTotal * (Number(payment.amount || 0) / paidTotal));
    allocated = roundMoney(allocated + amount);
    return { paymentId: payment.id, method: payment.method, amount };
  }).filter((allocation) => allocation.amount > 0);
}

function calculatePartialRefund(order, refundLines) {
  const originalGross = order.OrderItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  const netRatio = originalGross > 0 ? Number(order.total) / originalGross : 0;
  const lines = refundLines.map(({ orderItem, refundQty }) => {
    const grossTotal = roundMoney(Number(orderItem.unitPrice) * refundQty);
    const total = roundMoney(grossTotal * netRatio);
    const taxRate = Number(orderItem.taxRate || 0);
    const grossTax = taxRate > 0 ? grossTotal * (taxRate / (1 + taxRate)) : 0;
    const taxTotal = roundMoney(grossTax * netRatio);
    return {
      orderItemId: orderItem.id,
      productId: orderItem.productId,
      quantity: refundQty,
      grossTotal,
      discountTotal: roundMoney(grossTotal - total),
      taxTotal,
      total
    };
  });

  const total = roundMoney(lines.reduce((sum, line) => sum + line.total, 0));
  const taxTotal = roundMoney(lines.reduce((sum, line) => sum + line.taxTotal, 0));
  const discountTotal = roundMoney(lines.reduce((sum, line) => sum + line.discountTotal, 0));
  return {
    lines,
    subtotal: roundMoney(total - taxTotal),
    taxTotal,
    discountTotal,
    total,
    tenderAllocations: allocateTender(order.Payments, total)
  };
}

async function persistRefund({ order, userId, type, reason, accounting, transaction }) {
  const refund = await OrderRefund.create({
    orderId: order.id,
    tenantId: order.tenantId || null,
    userId: userId || null,
    type,
    subtotal: accounting.subtotal,
    taxTotal: accounting.taxTotal,
    discountTotal: accounting.discountTotal,
    total: accounting.total,
    tenderAllocations: accounting.tenderAllocations,
    reason: reason || null
  }, { transaction });

  if (accounting.lines?.length) {
    await OrderRefundItem.bulkCreate(
      accounting.lines.map((line) => ({ ...line, refundId: refund.id })),
      { transaction }
    );
  }
  return refund;
}

function fullRefundAccounting(order) {
  const calculated = calculatePartialRefund(
    order,
    order.OrderItems.map((orderItem) => ({ orderItem, refundQty: Number(orderItem.quantity) }))
  );
  const finalLine = calculated.lines[calculated.lines.length - 1];
  if (finalLine) {
    finalLine.total = roundMoney(finalLine.total + Number(order.total) - calculated.total);
    finalLine.taxTotal = roundMoney(finalLine.taxTotal + Number(order.taxTotal) - calculated.taxTotal);
    finalLine.discountTotal = roundMoney(
      finalLine.discountTotal + Number(order.discountTotal) - calculated.discountTotal
    );
  }
  return {
    lines: calculated.lines,
    subtotal: Number(order.subtotal),
    taxTotal: Number(order.taxTotal),
    discountTotal: Number(order.discountTotal),
    total: Number(order.total),
    tenderAllocations: allocateTender(order.Payments, Number(order.total))
  };
}

module.exports = {
  allocateTender,
  calculatePartialRefund,
  fullRefundAccounting,
  persistRefund,
  roundMoney
};
