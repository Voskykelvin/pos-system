/**
 * Builds the invoice payload that will eventually be sent to KRA eTIMS.
 *
 * NOTE: this is a reasonable placeholder shape based on public eTIMS
 * documentation patterns (trader info, item lines, tax breakdown, totals).
 * Once you have your SI (Service Initialization) credentials from iTax,
 * confirm the exact field names and required structure against KRA's
 * VSCU technical spec and adjust this function. Nothing here is sent
 * anywhere yet, it just prepares the JSON that gets stored on
 * EtimsInvoice.payload and queued for a sync worker to transmit.
 */
function buildEtimsPayload({ order, orderItems, business }) {
  const taxBreakdown = { standard: 0, zero_rated: 0, exempt: 0 };

  const items = orderItems.map((item) => {
    taxBreakdown[item.taxCategory] =
      (taxBreakdown[item.taxCategory] || 0) + Number(item.lineTotal);

    return {
      itemName: item.productName,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      taxRate: Number(item.taxRate),
      taxCategory: item.taxCategory,
      lineTotal: Number(item.lineTotal)
    };
  });

  return {
    traderSystemInvoiceNumber: order.orderNumber,
    invoiceDate: order.createdAt,
    businessPin: business.kraPin,
    businessName: business.name,
    customerPin: order.customerKraPin || null,
    items,
    taxBreakdown,
    subtotal: Number(order.subtotal),
    taxTotal: Number(order.taxTotal),
    discountTotal: Number(order.discountTotal),
    total: Number(order.total),
    currency: business.currency || 'KES'
  };
}

module.exports = { buildEtimsPayload };
