module.exports = (sequelize, DataTypes) => {
  const StockCountItem = sequelize.define('StockCountItem', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    stockCountId: { type: DataTypes.UUID, allowNull: false },
    productId: { type: DataTypes.UUID, allowNull: false },
    expectedQuantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    countedQuantity: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
    variance: { type: DataTypes.DECIMAL(12, 3), allowNull: true }
  }, { tableName: 'stock_count_items', timestamps: true });
  StockCountItem.associate = (models) => {
    StockCountItem.belongsTo(models.StockCount, { foreignKey: 'stockCountId' });
    StockCountItem.belongsTo(models.Product, { foreignKey: 'productId' });
  };
  return StockCountItem;
};
