module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('Category', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    taxCategory: {
      // Kenyan VAT: standard 16%, zero-rated, exempt
      type: DataTypes.ENUM('standard', 'zero_rated', 'exempt'),
      allowNull: false,
      defaultValue: 'standard'
    }
  }, {
    tableName: 'categories',
    timestamps: true
  });

  Category.associate = (models) => {
    Category.hasMany(models.Product, { foreignKey: 'categoryId' });
  };

  return Category;
};
