module.exports = (sequelize, DataTypes) => {
  const OrderItemLotAllocation = sequelize.define('OrderItemLotAllocation', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    orderItemId: { type: DataTypes.UUID, allowNull: false },
    inventoryLotId: { type: DataTypes.UUID, allowNull: false },
    quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    returnedQuantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false, defaultValue: 0 }
  }, { tableName: 'order_item_lot_allocations', timestamps: true });
  OrderItemLotAllocation.associate = (models) => {
    OrderItemLotAllocation.belongsTo(models.OrderItem, { foreignKey: 'orderItemId' });
    OrderItemLotAllocation.belongsTo(models.InventoryLot, { foreignKey: 'inventoryLotId' });
  };
  return OrderItemLotAllocation;
};
