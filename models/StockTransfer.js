module.exports = (sequelize, DataTypes) => {
  const StockTransfer = sequelize.define('StockTransfer', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: DataTypes.UUID, allowNull: false },
    sourceBranchId: { type: DataTypes.UUID, allowNull: false },
    destinationBranchId: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'completed' },
    note: { type: DataTypes.STRING(500), allowNull: true },
    createdByUserId: { type: DataTypes.UUID, allowNull: true }
  }, { tableName: 'stock_transfers', timestamps: true });
  StockTransfer.associate = (models) => {
    StockTransfer.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    StockTransfer.belongsTo(models.Branch, { foreignKey: 'sourceBranchId', as: 'sourceBranch' });
    StockTransfer.belongsTo(models.Branch, { foreignKey: 'destinationBranchId', as: 'destinationBranch' });
    StockTransfer.belongsTo(models.User, { foreignKey: 'createdByUserId', as: 'createdBy' });
    StockTransfer.hasMany(models.StockTransferItem, { foreignKey: 'stockTransferId' });
  };
  return StockTransfer;
};
