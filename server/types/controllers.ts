import type { AccessLevel } from '#lib/user_access_levels'
import type { Req, Res } from '#types/server'

type SanitizationObject = Record<string, unknown>

export type ActionControllerStandaloneFunction <Response = unknown | void> = (req: Req, res: Res) => Response
export type ActionControllerFunction <Response = unknown | void> = (params: unknown, req: Req, res: Res) => Response

export interface ActionControllerObject {
  sanitization: SanitizationObject
  controller: ActionControllerFunction
  track?: string[]
}

export type ActionController = ActionControllerStandaloneFunction | ActionControllerObject

type ActionName = string

interface AccessLevelControllers {
  [key: ActionName]: ActionController
}

export type ActionsControllers = {
  [K in AccessLevel]?: AccessLevelControllers
}

export type HttpVerb = 'get' | 'post' | 'put' | 'delete'
export type LowerCasedHttpVerb = HttpVerb

export type VerbsAndActionsControllers = Partial<Record<HttpVerb, ActionsControllers>>
