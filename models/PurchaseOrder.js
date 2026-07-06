module.exports = (sequelize, DataTypes) => {
  const PurchaseOrder = sequelize.define('PurchaseOrder', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    poNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    supplierId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    status: {
      // draft: being created
      // ordered: sent to supplier
      // received: goods received into stock
      // cancelled: PO voided
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'draft'
    },
    totalCost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    },
    expectedDelivery: {
      type: DataTypes.DATE,
      allowNull: true
    },
    receivedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.STRING,
      allowNull: true
    },
    createdById: {
      type: DataTypes.UUID,
      allowNull: true
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    tableName: 'purchase_orders',
    timestamps: true,
    indexes: [
      { fields: ['tenantId'] },
      { fields: ['poNumber'] },
      { fields: ['supplierId'] },
      { fields: ['status'] }
    ]
  });

  PurchaseOrder.associate = (models) => {
    PurchaseOrder.belongsTo(models.Supplier, { foreignKey: 'supplierId' });
    PurchaseOrder.belongsTo(models.User, { foreignKey: 'createdById', as: 'createdBy' });
    PurchaseOrder.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    PurchaseOrder.hasMany(models.PurchaseOrderItem, { foreignKey: 'purchaseOrderId', as: 'items' });
  };

  return PurchaseOrder;
};
