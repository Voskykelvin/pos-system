module.exports = (sequelize, DataTypes) => {
  const BranchInventory = sequelize.define('BranchInventory', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branchId: { type: DataTypes.UUID, allowNull: false },
    productId: { type: DataTypes.UUID, allowNull: false },
    quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false, defaultValue: 0 }
  }, { tableName: 'branch_inventory', timestamps: true });
  BranchInventory.associate = (models) => {
    BranchInventory.belongsTo(models.Branch, { foreignKey: 'branchId' });
    BranchInventory.belongsTo(models.Product, { foreignKey: 'productId' });
  };
  return BranchInventory;
};
