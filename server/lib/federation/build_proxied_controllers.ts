import { methodAndActionsControllersFactory } from '#lib/actions_controllers'
import { proxiedController } from '#lib/federation/proxied_controllers'
import { arrayIncludes, objectEntries } from '#lib/utils/base'
import type { RelativeUrl } from '#types/common'
import type { MethodsAndActionsControllers } from '#types/controllers'

const closedAccessLevels = [ 'admin', 'dataadmin' ] as const

// Use-cases for duplicating remote endpoints locally:
// - proxy read controllers to keep a local cache and trigger hooks
// - proxy write controllers to handle authenfication
// Note that requests requiring Wikidata OAuth could possibly be replaced by request
// authentified with a server Wikidata account
export function buildProxiedControllers (pathname: RelativeUrl, localControllersParams: MethodsAndActionsControllers) {
  const proxiedControllersParams = {}

  for (const [ method, methodParams ] of objectEntries(localControllersParams)) {
    proxiedControllersParams[method] = {}
    for (const [ accessLevel, actionControllers ] of objectEntries(methodParams)) {
      // Register closed endpoints as public to directly send the "Closed endpoint" error
      // rather than falsly hinting that it's an authentification problem
      const localAccessLevel = arrayIncludes(closedAccessLevels, accessLevel) ? 'public' : accessLevel
      proxiedControllersParams[method][localAccessLevel] ??= {}
      for (const [ actionName, actionController ] of objectEntries(actionControllers)) {
        const controller = proxiedController(accessLevel, method, pathname, actionName as string, actionController)
        proxiedControllersParams[method][localAccessLevel][actionName] = controller
      }
    }
  }

  return methodAndActionsControllersFactory(proxiedControllersParams)
}
