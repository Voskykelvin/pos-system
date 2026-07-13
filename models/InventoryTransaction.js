module.exports = (sequelize, DataTypes) => {
  const InventoryTransaction = sequelize.define('InventoryTransaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    type: {
      // purchase = stock in, sale = stock out, adjustment = manual correction,
      // return = customer return back to stock, wastage = spoilage/shrinkage write-off
      type: DataTypes.STRING,
      allowNull: false
    },
    quantity: {
      // positive for stock in, negative for stock out
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false
    },
    balanceAfter: {
      // snapshot of stockQuantity after this transaction, for audit trail
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false
    },
    referenceType: {
      // what triggered this: 'order', 'manual', 'supplier_delivery'
      type: DataTypes.STRING,
      allowNull: true
    },
    referenceId: {
      // e.g. the orderId if type is 'sale'
      type: DataTypes.UUID,
      allowNull: true
    },
    note: {
      type: DataTypes.STRING,
      allowNull: true
    },
    userId: {
      // who made the change, for accountability
      type: DataTypes.UUID,
      allowNull: true
    },
    branchId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    inventoryLotId: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    tableName: 'inventory_transactions',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['productId', 'createdAt'] }  // ledger history per product
    ]
  });

  InventoryTransaction.associate = (models) => {
    InventoryTransaction.belongsTo(models.Product, { foreignKey: 'productId' });
    InventoryTransaction.belongsTo(models.User, { foreignKey: 'userId' });
    InventoryTransaction.belongsTo(models.Branch, { foreignKey: 'branchId' });
    InventoryTransaction.belongsTo(models.InventoryLot, { foreignKey: 'inventoryLotId' });
  };

  return InventoryTransaction;
};
