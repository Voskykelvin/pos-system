module.exports = (sequelize, DataTypes) => {
  const StockCount = sequelize.define('StockCount', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenantId: { type: DataTypes.UUID, allowNull: true },
    branchId: { type: DataTypes.UUID, allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'draft' },
    note: { type: DataTypes.STRING(500), allowNull: true },
    createdByUserId: { type: DataTypes.UUID, allowNull: true },
    completedByUserId: { type: DataTypes.UUID, allowNull: true },
    completedAt: { type: DataTypes.DATE, allowNull: true }
  }, { tableName: 'stock_counts', timestamps: true });
  StockCount.associate = (models) => {
    StockCount.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    StockCount.belongsTo(models.Branch, { foreignKey: 'branchId' });
    StockCount.belongsTo(models.User, { foreignKey: 'createdByUserId', as: 'createdBy' });
    StockCount.belongsTo(models.User, { foreignKey: 'completedByUserId', as: 'completedBy' });
    StockCount.hasMany(models.StockCountItem, { foreignKey: 'stockCountId' });
  };
  return StockCount;
};
