module.exports = (sequelize, DataTypes) => {
  const Shift = sequelize.define('Shift', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    cashierId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    openedByUserId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    closedByUserId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'open'
    },
    openingFloat: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    },
    cashSalesExpected: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    },
    totalExpenses: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    },
    cashCounted: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    },
    cashVariance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    },
    openedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    note: {
      type: DataTypes.STRING,
      allowNull: true
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    branchId: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    tableName: 'shifts',
    timestamps: true,
    indexes: [
      { fields: ['tenantId'] },
      { fields: ['cashierId', 'status'] },
      { fields: ['openedAt'] }
    ]
  });

  Shift.associate = (models) => {
    Shift.belongsTo(models.User, { foreignKey: 'cashierId', as: 'cashier' });
    Shift.belongsTo(models.User, { foreignKey: 'openedByUserId', as: 'openedBy' });
    Shift.belongsTo(models.User, { foreignKey: 'closedByUserId', as: 'closedBy' });
    Shift.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    Shift.belongsTo(models.Branch, { foreignKey: 'branchId' });
  };

  return Shift;
};
