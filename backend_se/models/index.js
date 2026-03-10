import { DataTypes } from 'sequelize'
import { sequelize as sequelizeInstance } from '../config/database.js'

export const sequelize = sequelizeInstance

import { defineUser } from './user.js'
import { defineRefreshToken } from './refreshToken.js'
import { definePasswordResetToken } from './passwordResetToken.js'

export const User = defineUser(sequelize, DataTypes)
export const RefreshToken = defineRefreshToken(sequelize, DataTypes)
export const PasswordResetToken = definePasswordResetToken(sequelize, DataTypes)

// Associations
RefreshToken.belongsTo(User, { foreignKey: 'user_id' })
User.hasMany(RefreshToken, { foreignKey: 'user_id' })

PasswordResetToken.belongsTo(User, { foreignKey: 'user_id' })
User.hasMany(PasswordResetToken, { foreignKey: 'user_id' })

export default {
  sequelize,
  User,
  RefreshToken,
  PasswordResetToken,
}

