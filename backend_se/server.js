import dotenv from 'dotenv'
import app from './app.js'
import { sequelize } from './models/index.js'

dotenv.config()

const port = process.env.PORT || 8080
const dbSyncMode = (process.env.DB_SYNC || 'none').toLowerCase()

async function start() {
  try {
    await sequelize.authenticate()

    if (dbSyncMode === 'force') {
      await sequelize.sync({ force: true })
    } else if (dbSyncMode === 'alter') {
      await sequelize.sync({ alter: true })
    } else if (dbSyncMode === 'sync') {
      await sequelize.sync()
    } else {
      console.log('Database sync skipped (DB_SYNC=none)')
    }

    app.listen(port, () => {
      console.log(`Medical API listening on http://localhost:${port}`)
      console.log(`Healthcheck: http://localhost:${port}/api/health`)
    })
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

start()

