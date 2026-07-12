module.exports = (sequelize, DataTypes) => {
  const PurchaseReturn = sequelize.define('PurchaseReturn', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: DataTypes.UUID, allowNull: true },
    purchaseOrderId: { type: DataTypes.UUID, allowNull: false },
    supplierId: { type: DataTypes.UUID, allowNull: false },
    branchId: { type: DataTypes.UUID, allowNull: true },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'awaiting_supplier_credit' },
    reason: { type: DataTypes.STRING(500), allowNull: false },
    totalCost: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    createdByUserId: { type: DataTypes.UUID, allowNull: true }
  }, { tableName: 'purchase_returns', timestamps: true });
  PurchaseReturn.associate = (models) => {
    PurchaseReturn.belongsTo(models.PurchaseOrder, { foreignKey: 'purchaseOrderId' });
    PurchaseReturn.belongsTo(models.Supplier, { foreignKey: 'supplierId' });
    PurchaseReturn.belongsTo(models.Branch, { foreignKey: 'branchId' });
    PurchaseReturn.belongsTo(models.User, { foreignKey: 'createdByUserId', as: 'createdBy' });
    PurchaseReturn.hasMany(models.PurchaseReturnItem, { foreignKey: 'purchaseReturnId' });
  };
  return PurchaseReturn;
};
