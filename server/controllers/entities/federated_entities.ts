import { pick } from 'lodash-es'
import { localEntitiesControllersParams } from '#controllers/entities/entities'
import { verbAndActionsControllersFactory } from '#lib/actions_controllers'
import { requests_ } from '#lib/requests'
import { objectEntries } from '#lib/utils/base'
import { buildUrl } from '#lib/utils/url'
import config from '#server/config'
import type { ActionController, HttpVerb } from '#server/types/controllers'

const { remoteEntitiesOrigin } = config.federation

// Use-cases for duplicating remote endpoints locally:
// - proxy read controllers to keep a local cache and trigger hooks
// - proxy write controllers to handle authenfication
// Note that requests requiring Wikidata OAuth could possibly be replaced by request
// authentified with a server Wikidata account
const federatedEntitiesControllersParams = {}

for (const [ verb, verbParams ] of objectEntries(localEntitiesControllersParams)) {
  federatedEntitiesControllersParams[verb] = {}
  for (const [ accessLevel, actionControllers ] of objectEntries(verbParams)) {
    if (accessLevel === 'public' || accessLevel === 'authentified') {
      federatedEntitiesControllersParams[verb][accessLevel] = {}
      for (const [ actionName, actionController ] of objectEntries(actionControllers)) {
        const controller = proxiedController(verb, actionName as string, actionController)
        federatedEntitiesControllersParams[verb][accessLevel][actionName] = controller
      }
    }
  }
}

function proxiedController (verb: HttpVerb, action: string, actionController: ActionController) {
  let sanitization, track, transferableParams
  if (typeof actionController !== 'function') {
    ;({ sanitization, track } = actionController)
    transferableParams = sanitization ? Object.keys(sanitization) : []
  }
  async function controller (params: Record<string, unknown>) {
    let remoteUrl, body
    // Drop sanitization built parameters (ex: reqUserId)
    if (params) params = pick(params, transferableParams)
    if (verb === 'get' || verb === 'delete') {
      remoteUrl = buildUrl(`${remoteEntitiesOrigin}/api/entities`, { action, ...params })
    } else {
      remoteUrl = buildUrl(`${remoteEntitiesOrigin}/api/entities`, { action })
      body = params
    }
    const remoteRes = await requests_[verb](remoteUrl, { body })
    return remoteRes
  }
  if (typeof actionController === 'function') {
    return controller
  } else {
    // Sanitize locally before proxying
    return { controller, sanitization, track }
  }
}

export const federatedEntitiesControllers = verbAndActionsControllersFactory(federatedEntitiesControllersParams)
