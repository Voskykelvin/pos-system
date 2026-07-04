module.exports = (sequelize, DataTypes) => {
  const EtimsInvoice = sequelize.define('EtimsInvoice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true
    },
    status: {
      // queued = created locally, not yet sent
      // transmitted = KRA accepted it, cuInvoiceNumber is set
      // failed = KRA rejected it or repeated retries failed
      // cancelled = the underlying order was voided before transmission
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'queued'
    },
    payload: {
      // the exact JSON sent to eTIMS, kept for audit and retry
      type: DataTypes.JSONB,
      allowNull: false
    },
    cuInvoiceNumber: {
      // returned by KRA once accepted
      type: DataTypes.STRING,
      allowNull: true
    },
    qrCodeUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    responsePayload: {
      // raw response from KRA, useful for debugging failures
      type: DataTypes.JSONB,
      allowNull: true
    },
    retryCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    transmittedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'etims_invoices',
    timestamps: true,
    indexes: [
      { fields: ['status'] }
    ]
  });

  EtimsInvoice.associate = (models) => {
    EtimsInvoice.belongsTo(models.Order, { foreignKey: 'orderId' });
  };

  return EtimsInvoice;
};
