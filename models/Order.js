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
      allowNull: false,
      unique: true
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
      defaultValue: 0
    },
    total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
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
    }
  }, {
    tableName: 'orders',
    timestamps: true,
    indexes: [
      { fields: ['orderNumber'] },
      { fields: ['createdAt'] },
      { fields: ['cashierId', 'createdAt'] },   // shift-scoped queries
      { fields: ['status', 'createdAt'] }        // completed/voided filter in analytics
    ]
  });

  Order.associate = (models) => {
    Order.belongsTo(models.User, { foreignKey: 'cashierId', as: 'cashier' });
    Order.belongsTo(models.Customer, { foreignKey: 'customerId' });
    Order.hasMany(models.OrderItem, { foreignKey: 'orderId' });
    Order.hasMany(models.Payment, { foreignKey: 'orderId' });
    Order.hasOne(models.EtimsInvoice, { foreignKey: 'orderId' });
  };

  return Order;
};
