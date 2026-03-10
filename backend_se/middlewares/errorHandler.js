export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500
  const message = err.message || 'Internal Server Error'
  const details = err.details

  if (process.env.NODE_ENV !== 'test') {
    console.error('[ErrorHandler]', status, message, details || '')
  }

  res.status(status).json({ message, details })
}

