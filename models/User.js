module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('admin', 'manager', 'cashier'),
      allowNull: false,
      defaultValue: 'cashier'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'users',
    timestamps: true
  });

  User.associate = (models) => {
    User.hasMany(models.Order, { foreignKey: 'cashierId' });
    User.hasMany(models.InventoryTransaction, { foreignKey: 'userId' });
    User.hasMany(models.AuditLog, { foreignKey: 'userId', as: 'auditActions' });
    User.hasMany(models.AuditLog, { foreignKey: 'approvedByUserId', as: 'approvedActions' });
    User.hasMany(models.Shift, { foreignKey: 'cashierId', as: 'shifts' });
  };

  return User;
};
