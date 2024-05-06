import util from 'node:util'
import type { ContextualizedError } from '#lib/error/format_error'
import { warn } from '#lib/utils/logs'

export function shouldNotBeCalled (res?: unknown) {
  warn(util.inspect(res, false, null), 'undesired positive res')
  const err: ContextualizedError = new Error('function was expected not to be called')
  // Give 'shouldNotBeCalled' more chance to appear in the red text of the failing test
  // @ts-expect-error
  err.name = err.statusCode = 'shouldNotBeCalled'
  err.body = { status_verbose: 'shouldNotBeCalled' }
  err.context = { res }
  throw err
}

export function rethrowShouldNotBeCalledErrors (err: Error) {
  if (err.name === 'shouldNotBeCalled') throw err
}

export function makeSpy () {
  const spy = () => {
    spy.callCount++
  }
  spy.callCount = 0
  return spy
}
