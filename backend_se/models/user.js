import bcrypt from 'bcryptjs'

export function defineUser(sequelize, DataTypes) {
  const User = sequelize.define(
    'User',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

      cccd: { type: DataTypes.STRING(20), allowNull: false, unique: true },
      full_name: { type: DataTypes.STRING(200), allowNull: false },
      phone: { type: DataTypes.STRING(30), allowNull: false },
      address: { type: DataTypes.STRING(500), allowNull: false },

      password_hash: { type: DataTypes.STRING, allowNull: false },

      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

      avatar_data: { type: DataTypes.BLOB('long'), allowNull: true },
      avatar_mimetype: { type: DataTypes.STRING(100), allowNull: true },
    },
    {
      tableName: 'User',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      hooks: {
        async beforeCreate(instance) {
          if (instance.changed('password_hash') && instance.password_hash) {
            const salt = await bcrypt.genSalt(10)
            instance.password_hash = await bcrypt.hash(instance.password_hash, salt)
          }
        },
        async beforeUpdate(instance) {
          if (instance.changed('password_hash') && instance.password_hash) {
            const salt = await bcrypt.genSalt(10)
            instance.password_hash = await bcrypt.hash(instance.password_hash, salt)
          }
        },
      },
      indexes: [
        { unique: true, fields: ['cccd'] },
        { fields: ['phone'] },
      ],
    }
  )

  return User
}

