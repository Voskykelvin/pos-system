module.exports = (sequelize, DataTypes) => {
  const Supplier = sequelize.define('Supplier', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
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
    contactPerson: {
      type: DataTypes.STRING,
      allowNull: true
    },
    kraPin: {
      type: DataTypes.STRING,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'suppliers',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['name'] }
    ]
  });

  Supplier.associate = (models) => {
    Supplier.hasMany(models.PurchaseOrder, { foreignKey: 'supplierId' });
  };

  return Supplier;
};
