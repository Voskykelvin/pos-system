module.exports = (sequelize, DataTypes) => {
  const StoreCreditTransaction = sequelize.define('StoreCreditTransaction', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    customerId: { type: DataTypes.UUID, allowNull: false },
    tenantId: { type: DataTypes.UUID, allowNull: true },
    orderId: { type: DataTypes.UUID, allowNull: true },
    refundId: { type: DataTypes.UUID, allowNull: true },
    type: { type: DataTypes.STRING(20), allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    balanceAfter: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    note: { type: DataTypes.STRING(500), allowNull: true },
    createdByUserId: { type: DataTypes.UUID, allowNull: true }
  }, { tableName: 'store_credit_transactions', timestamps: true });
  StoreCreditTransaction.associate = (models) => {
    StoreCreditTransaction.belongsTo(models.Customer, { foreignKey: 'customerId' });
    StoreCreditTransaction.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    StoreCreditTransaction.belongsTo(models.Order, { foreignKey: 'orderId' });
    StoreCreditTransaction.belongsTo(models.OrderRefund, { foreignKey: 'refundId' });
    StoreCreditTransaction.belongsTo(models.User, { foreignKey: 'createdByUserId', as: 'createdBy' });
  };
  return StoreCreditTransaction;
};
