export function defineRefreshToken(sequelize, DataTypes) {
  const RefreshToken = sequelize.define(
    'RefreshToken',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      token_hash: { type: DataTypes.STRING(255), allowNull: false },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      revoked_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    {
      tableName: 'RefreshToken',
      createdAt: 'created_at',
      updatedAt: false,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['token_hash'] },
      ],
    }
  )

  return RefreshToken
}

