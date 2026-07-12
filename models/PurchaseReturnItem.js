module.exports = (sequelize, DataTypes) => {
  const PurchaseReturnItem = sequelize.define('PurchaseReturnItem', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    purchaseReturnId: { type: DataTypes.UUID, allowNull: false },
    purchaseOrderItemId: { type: DataTypes.UUID, allowNull: false },
    productId: { type: DataTypes.UUID, allowNull: false },
    inventoryLotId: { type: DataTypes.UUID, allowNull: true },
    quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    unitCost: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    lineTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false }
  }, { tableName: 'purchase_return_items', timestamps: true });
  PurchaseReturnItem.associate = (models) => {
    PurchaseReturnItem.belongsTo(models.PurchaseReturn, { foreignKey: 'purchaseReturnId' });
    PurchaseReturnItem.belongsTo(models.PurchaseOrderItem, { foreignKey: 'purchaseOrderItemId' });
    PurchaseReturnItem.belongsTo(models.Product, { foreignKey: 'productId' });
    PurchaseReturnItem.belongsTo(models.InventoryLot, { foreignKey: 'inventoryLotId' });
  };
  return PurchaseReturnItem;
};
