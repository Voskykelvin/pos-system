module.exports = (sequelize, DataTypes) => {
  const Promotion = sequelize.define('Promotion', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    code: {
      // e.g. SAVE10, WEEKEND20 — stored and matched uppercase
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true
    },
    type: {
      // percent = value is a percentage off total (e.g. 10 = 10%)
      // fixed   = value is a flat KES amount off total (e.g. 50 = KES 50 off)
      type: DataTypes.ENUM('percent', 'fixed'),
      allowNull: false
    },
    value: {
      // must be positive; interpreted based on type above
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    minOrderTotal: {
      // minimum cart total before discount applies (0 = no minimum)
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    maxUses: {
      // 0 = unlimited
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    usedCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    startsAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    createdByUserId: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    tableName: 'promotions',
    timestamps: true,
    indexes: [
      { fields: ['code'] },
      { fields: ['isActive', 'expiresAt'] }
    ]
  });

  Promotion.associate = (models) => {
    Promotion.belongsTo(models.User, { foreignKey: 'createdByUserId', as: 'createdBy' });
  };

  return Promotion;
};
