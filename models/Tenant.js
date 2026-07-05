module.exports = (sequelize, DataTypes) => {
  const Tenant = sequelize.define('Tenant', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'KES'
    },
    country: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'KE'
    },
    plan: {
      // starter, growth, enterprise
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'starter'
    },
    status: {
      // active, past_due, suspended
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'active'
    },
    ownerUserId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    settings: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    tableName: 'tenants',
    timestamps: true,
    indexes: [
      { fields: ['slug'] },
      { fields: ['status'] },
      { fields: ['plan'] }
    ]
  });

  Tenant.associate = (models) => {
    Tenant.belongsTo(models.User, { foreignKey: 'ownerUserId', as: 'owner' });
    Tenant.hasMany(models.User, { foreignKey: 'tenantId' });
    Tenant.hasMany(models.Branch, { foreignKey: 'tenantId' });
    Tenant.hasMany(models.Category, { foreignKey: 'tenantId' });
    Tenant.hasMany(models.Product, { foreignKey: 'tenantId' });
    Tenant.hasMany(models.Order, { foreignKey: 'tenantId' });
    Tenant.hasMany(models.Customer, { foreignKey: 'tenantId' });
    Tenant.hasMany(models.Shift, { foreignKey: 'tenantId' });
    Tenant.hasMany(models.Supplier, { foreignKey: 'tenantId' });
    Tenant.hasMany(models.PurchaseOrder, { foreignKey: 'tenantId' });
    Tenant.hasMany(models.Promotion, { foreignKey: 'tenantId' });
  };

  return Tenant;
};
