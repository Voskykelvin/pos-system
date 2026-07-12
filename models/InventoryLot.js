module.exports = (sequelize, DataTypes) => {
  const InventoryLot = sequelize.define('InventoryLot', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: DataTypes.UUID, allowNull: true },
    branchId: { type: DataTypes.UUID, allowNull: true },
    productId: { type: DataTypes.UUID, allowNull: false },
    supplierId: { type: DataTypes.UUID, allowNull: true },
    purchaseOrderId: { type: DataTypes.UUID, allowNull: true },
    lotNumber: { type: DataTypes.STRING(100), allowNull: false },
    expiryDate: { type: DataTypes.DATEONLY, allowNull: true },
    receivedQuantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    availableQuantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    unitCost: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    receivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, { tableName: 'inventory_lots', timestamps: true });
  InventoryLot.associate = (models) => {
    InventoryLot.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    InventoryLot.belongsTo(models.Branch, { foreignKey: 'branchId' });
    InventoryLot.belongsTo(models.Product, { foreignKey: 'productId' });
    InventoryLot.belongsTo(models.Supplier, { foreignKey: 'supplierId' });
    InventoryLot.belongsTo(models.PurchaseOrder, { foreignKey: 'purchaseOrderId' });
    InventoryLot.hasMany(models.OrderItemLotAllocation, { foreignKey: 'inventoryLotId' });
  };
  return InventoryLot;
};
