module.exports = (sequelize, DataTypes) => {
  const Branch = sequelize.define('Branch', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    code: {
      type: DataTypes.STRING,
      allowNull: true
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    address: {
      type: DataTypes.STRING,
      allowNull: true
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'branches',
    timestamps: true,
    indexes: [
      { fields: ['tenantId'] },
      { fields: ['isActive'] }
    ]
  });

  Branch.associate = (models) => {
    Branch.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    Branch.hasMany(models.User, { foreignKey: 'branchId' });
    Branch.hasMany(models.Order, { foreignKey: 'branchId' });
    Branch.hasMany(models.Shift, { foreignKey: 'branchId' });
    Branch.hasMany(models.BranchInventory, { foreignKey: 'branchId' });
  };

  return Branch;
};
