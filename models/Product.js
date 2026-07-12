module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define('Product', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: false
    },
    barcode: {
      type: DataTypes.STRING,
      allowNull: true
    },
    scaleCode: {
      type: DataTypes.STRING(5),
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
    tracksLots: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
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
    taxCategory: {
      // Per-product VAT classification. Category-level tax is only a fallback.
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'standard'
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
      defaultValue: 0,
      validate: { min: 0 }
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
    paranoid: true,
    indexes: [
      { unique: true, fields: ['tenantId', 'sku'] },
      { unique: true, fields: ['tenantId', 'barcode'] },
      { unique: true, fields: ['tenantId', 'scaleCode'] },
      { fields: ['categoryId'] },
      { fields: ['taxCategory'] },
      { fields: ['isActive'] }
    ]
  });

  Product.associate = (models) => {
    Product.belongsTo(models.Category, { foreignKey: 'categoryId' });
    Product.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    Product.hasMany(models.OrderItem, { foreignKey: 'productId' });
    Product.hasMany(models.InventoryTransaction, { foreignKey: 'productId' });
    Product.hasMany(models.BranchInventory, { foreignKey: 'productId' });
    Product.hasMany(models.InventoryLot, { foreignKey: 'productId' });
  };

  return Product;
};
