module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define('Payment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    method: {
      type: DataTypes.STRING,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending'
    },
    // M-Pesa specific fields, null for cash/card
    mpesaCheckoutRequestId: {
      // returned when you initiate an STK push, used to match the callback
      type: DataTypes.STRING,
      allowNull: true
    },
    mpesaReceiptNumber: {
      // e.g. QGR7XXXXX, only set once Safaricom confirms via callback
      type: DataTypes.STRING,
      allowNull: true
    },
    mpesaPhone: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'payments',
    timestamps: true,
    indexes: [
      { fields: ['mpesaCheckoutRequestId'] },
      { fields: ['orderId', 'method', 'status'] }  // payment-mix analytics
    ]
  });

  Payment.associate = (models) => {
    Payment.belongsTo(models.Order, { foreignKey: 'orderId' });
    Payment.hasMany(models.MpesaCallbackEvent, { foreignKey: 'paymentId' });
  };

  return Payment;
};
