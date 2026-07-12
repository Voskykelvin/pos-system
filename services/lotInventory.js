const { OrderItemLotAllocation, InventoryLot } = require('../models');

async function restoreLotsForOrderItem(orderItemId, quantity, transaction) {
  const allocations = await OrderItemLotAllocation.findAll({
    where: { orderItemId },
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    transaction,
    lock: transaction.LOCK.UPDATE
  });
  let remaining = Number(quantity);
  for (const allocation of allocations) {
    if (remaining <= 0) break;
    const restorable = Number(allocation.quantity) - Number(allocation.returnedQuantity || 0);
    const restored = Math.min(remaining, restorable);
    if (restored <= 0) continue;
    const lot = await InventoryLot.findByPk(allocation.inventoryLotId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!lot) throw new Error(`Inventory lot ${allocation.inventoryLotId} is missing`);
    await lot.update({ availableQuantity: Number(lot.availableQuantity) + restored }, { transaction });
    await allocation.update({ returnedQuantity: Number(allocation.returnedQuantity || 0) + restored }, { transaction });
    remaining = Math.round((remaining - restored) * 1000) / 1000;
  }
  if (remaining > 0 && allocations.length > 0) {
    throw Object.assign(new Error('Lot restoration exceeds the quantity originally allocated'), { status: 409 });
  }
  return Number(quantity) - remaining;
}

module.exports = { restoreLotsForOrderItem };
