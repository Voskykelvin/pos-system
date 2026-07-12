module.exports = (sequelize, DataTypes) => {
  const StockTransferItem = sequelize.define('StockTransferItem', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    stockTransferId: { type: DataTypes.UUID, allowNull: false },
    productId: { type: DataTypes.UUID, allowNull: false },
    quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false }
  }, { tableName: 'stock_transfer_items', timestamps: true });
  StockTransferItem.associate = (models) => {
    StockTransferItem.belongsTo(models.StockTransfer, { foreignKey: 'stockTransferId' });
    StockTransferItem.belongsTo(models.Product, { foreignKey: 'productId' });
  };
  return StockTransferItem;
};
