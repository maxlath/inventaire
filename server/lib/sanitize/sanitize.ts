import { camelCase, cloneDeep, isPlainObject } from 'lodash-es'
import { newError } from '#lib/error/error'
import type { ContextualizedError } from '#lib/error/format_error'
import { newMissingError, newInvalidError } from '#lib/error/pre_filled'
import { getLocalUserAcct } from '#lib/federation/remote_user'
import { addWarning } from '#lib/responses'
import { assertObject } from '#lib/utils/assert_types'
import { obfuscate } from '#lib/utils/base'
import { typeOf } from '#lib/utils/types'
import type { ControllerInputSanitization, FormatFunction, GenericParameterName, ParameterName, ParameterPlace, ControllerSanitizationParameterConfig, SanitizationParameter, RenameFunction } from '#types/controllers_input_sanitization'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import type { AuthentifiedReq, RemoteUserAuthentifiedReq, Req, Res } from '#types/server'
import { sanitizationParameters } from './parameters.js'

const { generics } = sanitizationParameters

// The sanitize function doesn't need to be async
// but has been used that way to be able to start promise chains
// There are some cases though where async is a problem, namely
// when something needs to be done during the current tick.
// Example: consumers of the request (aka req) stream need to run on the same tick.
// If they have to wait for the next tick, 'data' events might be over
export function sanitize (req: Req | AuthentifiedReq | RemoteUserAuthentifiedReq, res: Res, configs: ControllerInputSanitization) {
  assertObject(req.query)

  const place = getPlace(req.method, configs)
  const rawInput: unknown = cloneDeep(req[place])

  if (!isPlainObject(rawInput)) {
    const type = typeOf(rawInput)
    throw newError(`${place} should be an object, got ${type}`, 400)
  }

  const input = rawInput as Record<string, unknown>

  if ('action' in input) delete input.action

  for (const name in input) {
    removeUnexpectedParameter(input, name, configs, res)
  }

  for (const name in configs) {
    if (!optionsNames.has(name)) {
      const config = configs[name]
      sanitizeParameter(input, name as ParameterName, config, place, res)
    }
  }

  if ('user' in req) {
    input.reqUserId = req.user._id
    input.reqUserAcct = getLocalUserAcct(req.user)
  } else if ('remoteUser' in req) {
    input.reqUserAcct = req.remoteUser.acct
  }

  return input as SanitizedParameters
}

const optionsNames = new Set([ 'nonJsonBody' ])

function sanitizeParameter (input: unknown, name: ParameterName, config: ControllerSanitizationParameterConfig, place: ParameterPlace, res: Res) {
  const parameter = getParameterFunctions(name, config.generic)

  if (parameter.drop) {
    delete input[name]
    return
  }

  if (input[name] == null) applyDefaultValue(input, name, config, parameter)
  if (input[name] == null) {
    if ('canBeNull' in config && config.canBeNull && input[name] === null) return
    else if ('optional' in config && config.optional) return
    else throw newMissingError(place, name)
  }

  format(input, name, parameter.format, config)

  // May throw a custom error, to avoid getting the general error
  // created hereafter
  if (!parameter.validate(input[name], name, config)) {
    const err = newInvalidError(name, input[name])
    obfuscateSecret(parameter, err)
    throw err
  }

  enforceBoundaries(input, name, config, parameter, res)

  renameParameter(input, name, camelCase, config)
  renameParameter(input, name, parameter.rename, config)
}

function getParameterFunctions (name: string, generic?: GenericParameterName) {
  let parameter
  if (generic) {
    parameter = generics[generic]
  } else if (prefixedParameterPattern.test(name)) {
    const unprefixedName = name.replace(prefixedParameterPattern, '')
    parameter = sanitizationParameters[unprefixedName]
  } else {
    parameter = sanitizationParameters[name]
  }
  return parameter
}

export function validateSanitization (configs: ControllerInputSanitization) {
  for (const name in configs) {
    if (!optionsNames.has(name)) {
      const config = configs[name]
      validateSanitizationParameter(name, config)
    }
  }
  return configs
}

function validateSanitizationParameter (name: string, config: ControllerSanitizationParameterConfig) {
  const { generic } = config
  const parameter = getParameterFunctions(name, generic)
  if (parameter == null) {
    if (generic) {
      throw newError('invalid generic name', 500, { name, generic })
    } else {
      throw newError('invalid parameter name', 500, { name })
    }
  }
}

const prefixedParameterPattern = /^(old|new|current)-/

function getPlace (method: string, configs: ControllerInputSanitization) {
  let place = 'query'
  if (method === 'POST' || method === 'PUT') {
    if (!configs.nonJsonBody) place = 'body'
  }
  return place as ParameterPlace
}

function removeUnexpectedParameter (input: unknown, name: string, configs: ControllerInputSanitization, res: Res) {
  if (configs[name] == null) {
    addWarning(res, `unexpected parameter: ${name}`)
    delete input[name]
  }
}

function format (input: unknown, name: ParameterName, formatFn: FormatFunction | undefined, config: ControllerSanitizationParameterConfig) {
  if (!formatFn) return
  try {
    input[name] = formatFn(input[name], name, config)
  } catch (err) {
    const formatError = newError('could not format input', 500, { input, name, formatFn, config })
    formatError.cause = err
    throw formatError
  }
}

function applyDefaultValue (input: unknown, name: ParameterName, config: ControllerSanitizationParameterConfig, parameter: SanitizationParameter) {
  // Accept 'null' as a default value
  if ('default' in config && config.default !== undefined) {
    input[name] = cloneDeep(config.default)
  } else if ('default' in parameter && parameter.default !== undefined) {
    input[name] = cloneDeep(parameter.default)
  }
}

function obfuscateSecret (parameter: SanitizationParameter, err: ContextualizedError) {
  if ('secret' in parameter && parameter.secret && typeof err.context.value === 'string') {
    err.context.value = obfuscate(err.context.value)
  }
}

function enforceBoundaries (input: unknown, name: ParameterName, config: ControllerSanitizationParameterConfig, parameter: SanitizationParameter, res: Res) {
  const min = ('min' in config && config.min) || ('min' in parameter && parameter.min)
  const max = ('max' in config && config.max) || ('max' in parameter && parameter.max)
  if (typeof min === 'number' && input[name] < min) {
    enforceBoundary(input, name, min, res, 'under')
  } else if (typeof max === 'number' && input[name] > max) {
    enforceBoundary(input, name, max, res, 'over')
  }
}

function enforceBoundary (input: unknown, name: ParameterName, boundary: number, res: Res, position: string) {
  input[name] = boundary
  addWarning(res, `${name} can't be ${position} ${boundary}`)
}

function renameParameter (input: unknown, name: ParameterName, renameFn: RenameFunction, config: ControllerSanitizationParameterConfig) {
  if (renameFn == null) return
  const aliasedName = renameFn(name, config)
  input[aliasedName] = input[name]
}
