module.exports = (sequelize, DataTypes) => {
  const CustomerLedger = sequelize.define('CustomerLedger', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    orderId: {
      // Null if it's a direct payment rather than a purchase
      type: DataTypes.UUID,
      allowNull: true
    },
    type: {
      // 'charge' (increases debt), 'payment' (decreases debt)
      type: DataTypes.STRING,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    balanceAfter: {
      // Snapshot of creditBalance after this transaction
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    notes: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'customer_ledgers',
    timestamps: true,
    indexes: [
      { fields: ['customerId'] },
      { fields: ['tenantId'] }
    ]
  });

  CustomerLedger.associate = (models) => {
    CustomerLedger.belongsTo(models.Customer, { foreignKey: 'customerId' });
    CustomerLedger.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    CustomerLedger.belongsTo(models.Order, { foreignKey: 'orderId' });
  };

  return CustomerLedger;
};
