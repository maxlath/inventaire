import type { genericParameters, sanitizationParameters } from '#lib/sanitize/parameters'

export type ParameterName = string
type WellknownParameterName = keyof typeof sanitizationParameters
type WellknownSanitizationParameter = typeof sanitizationParameters[WellknownParameterName]
export type GenericParameterName = keyof typeof genericParameters
type GenericSanitizationParameter = typeof genericParameters[GenericParameterName]
export type SanitizationParameter = WellknownSanitizationParameter | GenericSanitizationParameter

type ParameterNamePrefix = 'new' | 'old'
type PrefixedParameterName = `${ParameterNamePrefix}-${ParameterName}`
type OtherParameterName = Exclude<string, ParameterName | PrefixedParameterName>

export type ParameterPlace = 'query' | 'body'

interface CommonControllerSanitizationParameterConfig extends Record<string, unknown> {
  allowlist?: string[]
  canBeNull?: boolean
  default?: boolean
  drop?: boolean
  max?: number
  optional?: boolean
  type?: string
}

interface GenericControllerSanitizationParameterConfig extends CommonControllerSanitizationParameterConfig {
  generic: GenericParameterName
}

// ControllerSanitizationParameterConfig would better be written like this, but then errors appear on sanitization configs missing the generic attribute
// type WellknownControllerSanitizationParameterConfig = (CommonControllerSanitizationParameterConfig | EmptyObject) & { generic: never }
// export type ControllerSanitizationParameterConfig = WellknownControllerSanitizationParameterConfig | GenericControllerSanitizationParameterConfig
export type ControllerSanitizationParameterConfig = CommonControllerSanitizationParameterConfig & {
  generic?: GenericParameterName
}

type ControllerInputSanitizationOptions = {
  nonJsonBody: boolean
}

type WellknownControllerInputSanitization = {
  [key in ParameterName | PrefixedParameterName]: ControllerSanitizationParameterConfig
}
type GenericControllerInputSanitization = Record<OtherParameterName, GenericControllerSanitizationParameterConfig>

export type ControllerInputSanitization = Partial<WellknownControllerInputSanitization & GenericControllerInputSanitization & ControllerInputSanitizationOptions>

export type FormatFunction = (value: string, name: ParameterName, config: ControllerSanitizationParameterConfig) => unknown
export type RenameFunction = (name: ParameterName, config: ControllerSanitizationParameterConfig) => string
