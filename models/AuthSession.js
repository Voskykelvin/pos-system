module.exports = (sequelize, DataTypes) => {
  const AuthSession = sequelize.define('AuthSession', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    tokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true
    },
    refreshTokenHash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true
    },
    refreshExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    userAgent: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    ipAddress: {
      type: DataTypes.STRING(64),
      allowNull: true
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'auth_sessions',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['tokenHash'] },
      { fields: ['userId', 'revokedAt', 'expiresAt'] }
    ]
  });

  AuthSession.associate = (models) => {
    AuthSession.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return AuthSession;
};
