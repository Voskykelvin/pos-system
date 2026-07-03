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
      unique: true,
      allowNull: true
    },
    kraPin: {
      // customers can request eTIMS invoices with their own PIN for expense claims
      type: DataTypes.STRING,
      allowNull: true
    },
    loyaltyPoints: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    tableName: 'customers',
    timestamps: true
  });

  Customer.associate = (models) => {
    Customer.hasMany(models.Order, { foreignKey: 'customerId' });
  };

  return Customer;
};
