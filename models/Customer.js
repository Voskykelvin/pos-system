module.exports = (sequelize, DataTypes) => {
  const Customer = sequelize.define('Customer', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    kraPin: {
      // customers can request eTIMS invoices with their own PIN for expense claims
      type: DataTypes.STRING,
      allowNull: true
    },
    loyaltyPoints: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: { min: 0 }
    },
    creditLimit: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    creditBalance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    storeCreditBalance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    tableName: 'customers',
    timestamps: true,
    paranoid: true,
    indexes: [
      { unique: true, fields: ['tenantId', 'phone'] }
    ]
  });

  Customer.associate = (models) => {
    Customer.hasMany(models.Order, { foreignKey: 'customerId' });
    Customer.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    Customer.hasMany(models.StoreCreditTransaction, { foreignKey: 'customerId' });
  };

  return Customer;
};
