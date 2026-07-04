module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define('Product', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    barcode: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    unit: {
      // each, kg, litre, etc. Needed for weighing-scale items
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'each'
    },
    isWeighted: {
      // true for loose produce sold by weight
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    costPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    },
    sellingPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    wholesalePrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    },
    reorderLevel: {
      type: DataTypes.INTEGER,
      defaultValue: 5
    },
    stockQuantity: {
      // running balance, kept in sync by InventoryTransaction entries
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 0
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    imageUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {}
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    tableName: 'products',
    timestamps: true,
    paranoid: true
  });

  Product.associate = (models) => {
    Product.belongsTo(models.Category, { foreignKey: 'categoryId' });
    Product.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    Product.hasMany(models.OrderItem, { foreignKey: 'productId' });
    Product.hasMany(models.InventoryTransaction, { foreignKey: 'productId' });
  };

  return Product;
};
