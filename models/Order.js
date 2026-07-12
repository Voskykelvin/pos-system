module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    orderNumber: {
      // human-readable receipt number, e.g. sequential per till
      type: DataTypes.STRING,
      allowNull: false
    },
    cashierId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    taxTotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    },
    discountTotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {}
    },
    total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    refundedSubtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    refundedTaxTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    refundedDiscountTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    refundedTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    status: {
      // voided orders keep the record but reverse all stock
      // partial_refund = some items returned, order still has active items
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'completed'
    },
    paymentStatus: {
      type: DataTypes.ENUM('pending', 'paid', 'partial', 'failed', 'reversed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    branchId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    offlineDeviceId: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    offlineSequence: {
      type: DataTypes.BIGINT,
      allowNull: true
    }
  }, {
    tableName: 'orders',
    timestamps: true,
    indexes: [
      { fields: ['tenantId'] },
      { unique: true, fields: ['tenantId', 'orderNumber'] },
      { fields: ['createdAt'] },
      { fields: ['cashierId', 'createdAt'] },   // shift-scoped queries
      { fields: ['status', 'createdAt'] },       // completed/voided filter in analytics
      { unique: true, fields: ['tenantId', 'offlineDeviceId', 'offlineSequence'] }
    ]
  });

  Order.associate = (models) => {
    Order.belongsTo(models.User, { foreignKey: 'cashierId', as: 'cashier' });
    Order.belongsTo(models.Customer, { foreignKey: 'customerId' });
    Order.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    Order.belongsTo(models.Branch, { foreignKey: 'branchId' });
    Order.hasMany(models.OrderItem, { foreignKey: 'orderId' });
    Order.hasMany(models.Payment, { foreignKey: 'orderId' });
    Order.hasMany(models.OrderRefund, { foreignKey: 'orderId' });
    Order.hasOne(models.EtimsInvoice, { foreignKey: 'orderId' });
  };

  return Order;
};
