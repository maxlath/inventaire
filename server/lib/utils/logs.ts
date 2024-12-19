import util from 'node:util'
import { isArguments } from 'lodash-es'
import chalk, { red, grey } from 'tiny-chalk'
import { isAbsoluteUrl } from '#lib/boolean_validations'
import { iscontextualizedError, type ContextualizedError } from '#lib/error/format_error'
import { getHost } from '#lib/network/helpers'
import config from '#server/config'
import type { AbsoluteUrl, Host } from '#types/common'

const { offline, verbose } = config
// Log full objects
util.inspect.defaultOptions.depth = 20

let errorCount = 0
const countsByHostAndErrorStatusCode = {}

const print = (str: string) => process.stdout.write(str + '\n')

export function log (obj: unknown, label?: string, color: string = 'cyan') {
  if (!verbose) return
  if ((typeof obj === 'string') && (label == null)) {
    print(chalk[color](obj))
  } else {
    // converting arguments object to array for readablilty
    // @ts-ignore Using ignore as some environment (namely prod) gives "TS2578: Unused '@ts-expect-error' directive"
    if (isArguments(obj)) obj = Array.from(obj)
    if (label != null) {
      print(grey('****** ') + chalk[color](label.toString()) + grey(' ******'))
    } else {
      print(chalk[color]('******************************'))
    }
    if (typeof obj === 'object') {
      console.log(obj)
    } else {
      print(obj?.toString())
    }
    print(grey('-----'))
  }
}

export const success = (obj: unknown, label?: string) => log(obj, label, 'green')
export const info = (obj: unknown, label?: string) => log(obj, label, 'blue')
export function warn (err: unknown, label?: string) {
  if (iscontextualizedError(err)) {
    const url = err.context?.url
    // Local 404 errors don't need to be logged, as they will be logged
    // by the request logger middleware and logging the error object is of no help,
    // everything is in the URL
    if (err.statusCode === 404 && url && url[0] === '/') return
  }
  if (err instanceof Error) {
    // shorten the stack trace
    err.stack = err.stack.split('\n').slice(0, 10).join('\n')
    reduceForwardedErrorsVerbosity(err)
  }

  log(err, label, 'yellow')
}

export function logError (err: ContextualizedError, label?: string) {
  if (!(err instanceof Error)) {
    throw new Error('invalid error object')
  }

  // If the error is of a lower lever than 500, make it a warning, not an error
  if ((err.statusCode != null) && (err.statusCode < 500)) {
    return warn(err, label)
  }

  // Prevent logging big error stack traces for network errors
  // in offline development mode
  if (offline && (err.code === 'ENOTFOUND')) {
    log(err.message, `${label} (offline)`, 'red')
    return
  }

  reduceForwardedErrorsVerbosity(err)
  log(err, label, 'red')

  let host = 'local'
  if ('context' in err) {
    const { host: errHost, url } = err.context
    host = (errHost as Host) || (isAbsoluteUrl(url) ? getHost(url as AbsoluteUrl) : 'local')
  }
  const errorStatusCode = err.statusCode || 500
  countsByHostAndErrorStatusCode[host] ??= {}
  countsByHostAndErrorStatusCode[host][errorStatusCode] ??= 0
  countsByHostAndErrorStatusCode[host][errorStatusCode]++
  errorCount++
}

function reduceForwardedErrorsVerbosity (err: ContextualizedError) {
  if ('forwardedFrom' in err) {
    if ('emitter' in err) delete err.emitter
  }
}

export function logErrorMessage (label?: string) {
  log(label, null, 'red')
}

const tapLogger = logger => label => obj => {
  logger(obj, label)
  return obj
}

export const Log = tapLogger(log)
export const LogError = tapLogger(logError)

function errorRethrow (err: ContextualizedError, label?: string) {
  logError(err, label)
  throw err
}

export const LogErrorAndRethrow = tapLogger(errorRethrow)

// logs the errors total if there was an error
// in the last 5 seconds
// -> just a convenience for debugging
export function logErrorsCount () {
  let prev = 0
  const counter = () => {
    if (errorCount !== prev) {
      prev = errorCount
      console.log(red('errors by hosts and status codes:'), countsByHostAndErrorStatusCode)
    }
  }
  setInterval(counter, 5000)
}
