module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('Category', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    taxCategory: {
      // Kenyan VAT: standard 16%, zero-rated, exempt
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'standard'
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    tableName: 'categories',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['tenantId', 'name'] }
    ]
  });

  Category.associate = (models) => {
    Category.hasMany(models.Product, { foreignKey: 'categoryId' });
    Category.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
  };

  return Category;
};
