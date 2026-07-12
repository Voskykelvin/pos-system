module.exports = (sequelize, DataTypes) => {
  const OrderRefundItem = sequelize.define('OrderRefundItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    refundId: { type: DataTypes.UUID, allowNull: false },
    orderItemId: { type: DataTypes.UUID, allowNull: false },
    productId: { type: DataTypes.UUID, allowNull: false },
    quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
    grossTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    discountTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    taxTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(12, 2), allowNull: false }
  }, {
    tableName: 'order_refund_items',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['refundId'] },
      { fields: ['orderItemId'] },
      { fields: ['productId'] }
    ]
  });

  OrderRefundItem.associate = (models) => {
    OrderRefundItem.belongsTo(models.OrderRefund, { foreignKey: 'refundId' });
    OrderRefundItem.belongsTo(models.OrderItem, { foreignKey: 'orderItemId' });
    OrderRefundItem.belongsTo(models.Product, { foreignKey: 'productId' });
  };

  return OrderRefundItem;
};
