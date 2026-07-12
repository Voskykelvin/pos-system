module.exports = (sequelize, DataTypes) => {
  const EtimsCreditNote = sequelize.define('EtimsCreditNote', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    refundId: { type: DataTypes.UUID, allowNull: false, unique: true },
    orderId: { type: DataTypes.UUID, allowNull: false },
    originalInvoiceId: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'queued' },
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    cuCreditNoteNumber: { type: DataTypes.STRING(100), allowNull: true },
    responsePayload: { type: DataTypes.JSONB, allowNull: true },
    retryCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    nextAttemptAt: { type: DataTypes.DATE, allowNull: true },
    lockedAt: { type: DataTypes.DATE, allowNull: true },
    lockToken: { type: DataTypes.UUID, allowNull: true },
    transmittedAt: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'etims_credit_notes',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['refundId'] },
      { fields: ['status', 'nextAttemptAt', 'createdAt'] },
      { fields: ['orderId', 'createdAt'] }
    ]
  });

  EtimsCreditNote.associate = (models) => {
    EtimsCreditNote.belongsTo(models.OrderRefund, { foreignKey: 'refundId' });
    EtimsCreditNote.belongsTo(models.Order, { foreignKey: 'orderId' });
    EtimsCreditNote.belongsTo(models.EtimsInvoice, { foreignKey: 'originalInvoiceId', as: 'originalInvoice' });
  };
  return EtimsCreditNote;
};
