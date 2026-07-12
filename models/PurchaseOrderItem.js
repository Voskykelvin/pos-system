module.exports = (sequelize, DataTypes) => {
  const PurchaseOrderItem = sequelize.define('PurchaseOrderItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    purchaseOrderId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    orderedQuantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false
    },
    receivedQuantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 0
    },
    returnedQuantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 0
    },
    unitCostPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    lineTotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    }
  }, {
    tableName: 'purchase_order_items',
    timestamps: true,
    indexes: [
      { fields: ['purchaseOrderId'] },
      { fields: ['productId'] }
    ]
  });

  PurchaseOrderItem.associate = (models) => {
    PurchaseOrderItem.belongsTo(models.PurchaseOrder, { foreignKey: 'purchaseOrderId' });
    PurchaseOrderItem.belongsTo(models.Product, { foreignKey: 'productId' });
  };

  return PurchaseOrderItem;
};
