module.exports = (sequelize, DataTypes) => {
  const SubscriptionPayment = sequelize.define('SubscriptionPayment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    plan: {
      type: DataTypes.STRING,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'KES'
    },
    method: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'mpesa_manual'
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending'
    },
    reference: {
      type: DataTypes.STRING,
      allowNull: false
    },
    payerName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    payerPhone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    confirmedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    rejectedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    reviewedByUserId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    periodStart: {
      type: DataTypes.DATE,
      allowNull: true
    },
    periodEnd: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    adminNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    tableName: 'subscription_payments',
    timestamps: true,
    indexes: [
      { fields: ['tenantId', 'status'] },
      { fields: ['reference'] },
      { fields: ['submittedAt'] },
      { fields: ['periodEnd'] }
    ]
  });

  SubscriptionPayment.associate = (models) => {
    SubscriptionPayment.belongsTo(models.Tenant, { foreignKey: 'tenantId' });
    SubscriptionPayment.belongsTo(models.User, { foreignKey: 'reviewedByUserId', as: 'reviewer' });
  };

  return SubscriptionPayment;
};
