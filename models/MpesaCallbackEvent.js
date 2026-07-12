module.exports = (sequelize, DataTypes) => {
  const MpesaCallbackEvent = sequelize.define('MpesaCallbackEvent', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    payloadHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    checkoutRequestId: { type: DataTypes.STRING(100), allowNull: true },
    paymentId: { type: DataTypes.UUID, allowNull: true },
    resultCode: { type: DataTypes.INTEGER, allowNull: true },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'received' },
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    error: { type: DataTypes.TEXT, allowNull: true },
    deliveryCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    processedAt: { type: DataTypes.DATE, allowNull: true },
    resolution: { type: DataTypes.STRING(30), allowNull: true },
    resolutionNote: { type: DataTypes.STRING(500), allowNull: true },
    resolvedByUserId: { type: DataTypes.UUID, allowNull: true },
    resolvedAt: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'mpesa_callback_events',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['payloadHash'] },
      { fields: ['checkoutRequestId', 'createdAt'] },
      { fields: ['status', 'createdAt'] }
    ]
  });

  MpesaCallbackEvent.associate = (models) => {
    MpesaCallbackEvent.belongsTo(models.Payment, { foreignKey: 'paymentId' });
    MpesaCallbackEvent.belongsTo(models.User, { foreignKey: 'resolvedByUserId', as: 'resolvedBy' });
  };

  return MpesaCallbackEvent;
};
