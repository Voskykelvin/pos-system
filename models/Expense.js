module.exports = (sequelize, DataTypes) => {
  const Expense = sequelize.define('Expense', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    category: {
      // e.g., 'Wages', 'Utilities', 'Supplies', 'Other'
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true
    },
    shiftId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    cashierId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false
    }
  }, {
    tableName: 'expenses',
    timestamps: true,
    indexes: [
      { fields: ['shiftId'] },
      { fields: ['tenantId'] }
    ]
  });

  Expense.associate = (models) => {
    Expense.belongsTo(models.Shift, { foreignKey: 'shiftId' });
    Expense.belongsTo(models.User, { foreignKey: 'cashierId', as: 'cashier' });
    Expense.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
  };

  return Expense;
};
