module.exports = (sequelize, DataTypes) => {
  const LoyaltyTransaction = sequelize.define('LoyaltyTransaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    orderId: {
      // null for manual adjustments by admin
      type: DataTypes.UUID,
      allowNull: true
    },
    type: {
      // earn = points awarded on a sale
      // redeem = points spent at checkout
      // adjust = manual correction by admin
      type: DataTypes.STRING,
      allowNull: false
    },
    points: {
      // positive for earn/adjust-in, negative for redeem/adjust-out
      type: DataTypes.INTEGER,
      allowNull: false
    },
    balanceBefore: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    balanceAfter: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    note: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'loyalty_transactions',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['customerId'] },
      { fields: ['customerId', 'createdAt'] }
    ]
  });

  LoyaltyTransaction.associate = (models) => {
    LoyaltyTransaction.belongsTo(models.Customer, { foreignKey: 'customerId' });
    LoyaltyTransaction.belongsTo(models.Order, { foreignKey: 'orderId' });
  };

  return LoyaltyTransaction;
};
