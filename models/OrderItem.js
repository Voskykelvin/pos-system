module.exports = (sequelize, DataTypes) => {
  const OrderItem = sequelize.define('OrderItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false
    },
    unitPrice: {
      // snapshot at time of sale, prices change over time
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    costPrice: {
      // snapshot at time of sale for gross profit calculations
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    },
    taxRate: {
      // snapshot, e.g. 0.16 for standard VAT
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0
    },
    lineTotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    }
  }, {
    tableName: 'order_items',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['orderId'] },
      { fields: ['productId'] }   // analytics product-sales join
    ]
  });

  OrderItem.associate = (models) => {
    OrderItem.belongsTo(models.Order, { foreignKey: 'orderId' });
    OrderItem.belongsTo(models.Product, { foreignKey: 'productId' });
  };

  return OrderItem;
};
