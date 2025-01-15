import express from 'express'
import { isArray } from '#lib/boolean_validations'
import { info } from '#lib/utils/logs'
import config from '#server/config'
import { middlewareErrorHandler } from '#server/middlewares/middleware_error_handler'
import { routes } from './controllers/routes.js'
import { middlewares } from './middlewares/middlewares.js'

const { port, hostname, name, publicProtocol } = config

export function initExpress () {
  const app = express()

  for (const middleware of middlewares) {
    if (isArray(middleware)) {
      const [ path, middlewareFn ] = middleware
      app.use(path, middlewareFn)
    } else {
      app.use(middleware)
    }
  }

  for (const endpoint in routes) {
    const controllers = routes[endpoint]
    for (const method in controllers) {
      const controller = controllers[method]
      app[method](`/${endpoint}`, controller)
    }
  }

  // Should be used after all middlewares and routes
  // cf http://expressjs.com/fr/guide/error-handling.html
  app.use(middlewareErrorHandler)

  if (publicProtocol === 'https') {
    // Allows Nginx to pass a "X-Forwarded-Proto=https" header
    // Required to set secure cookies
    // See https://expressjs.com/en/api.html#trust.proxy.options.table
    app.set('trust proxy', 'loopback')
  }

  app.disable('x-powered-by')

  return new Promise((resolve, reject) => {
    app.listen(port, hostname, (err?: Error) => {
      if (err) {
        reject(err)
      } else {
        info(`${name} server is listening on port ${port}...`)
        resolve(app)
      }
    })
  })
}
