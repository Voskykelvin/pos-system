module.exports = (sequelize, DataTypes) => {
  const OrderRefund = sequelize.define('OrderRefund', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    orderId: { type: DataTypes.UUID, allowNull: false },
    tenantId: { type: DataTypes.UUID, allowNull: true },
    userId: { type: DataTypes.UUID, allowNull: true },
    type: { type: DataTypes.STRING, allowNull: false },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    taxTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    discountTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    tenderAllocations: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
    reason: { type: DataTypes.STRING(500), allowNull: true }
  }, {
    tableName: 'order_refunds',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['orderId', 'createdAt'] },
      { fields: ['tenantId', 'createdAt'] }
    ]
  });

  OrderRefund.associate = (models) => {
    OrderRefund.belongsTo(models.Order, { foreignKey: 'orderId' });
    OrderRefund.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    OrderRefund.belongsTo(models.User, { foreignKey: 'userId' });
    OrderRefund.hasMany(models.OrderRefundItem, { foreignKey: 'refundId' });
    OrderRefund.hasOne(models.EtimsCreditNote, { foreignKey: 'refundId' });
  };

  return OrderRefund;
};
