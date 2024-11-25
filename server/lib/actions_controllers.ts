import { objectEntries } from '#lib/utils/base'
import validateObject from '#lib/validate_object'
import type { ActionController, ActionsControllers, VerbsAndActionsControllers } from '#types/controllers'
import type { Req, Res } from '#types/server'
import { controllerWrapper, validateControllerWrapperParams } from './controller_wrapper.js'
import { bundleMissingQueryError, bundleUnknownAction } from './error/pre_filled.js'
import { accessLevels, type AccessLevel } from './user_access_levels.js'

// A function to route requests to an endpoint to sub-endpoints identified by their 'action' names

export function actionsControllersFactory (controllers: ActionsControllers) {
  const actionsControllersParams = getActionsControllersParams(controllers)
  return async (req: Req, res: Res) => {
    // Accepting the action to be passed either as a query string
    // or as a body parameter for more flexibility
    const action = req.query.action || req.body.action || 'default'

    if (action === 'default' && !('default' in actionsControllersParams)) {
      return bundleMissingQueryError(req, res, 'action')
    }

    const controllerParams = actionsControllersParams[action]
    if (controllerParams == null) return bundleUnknownAction(req, res)

    return controllerWrapper(controllerParams, req, res)
  }
}

function getActionsControllersParams (controllers: ActionsControllers) {
  validateObject(controllers, accessLevels, 'object')
  const actionsControllersParams = {}
  for (const [ accessLevel, actionControllers ] of objectEntries(controllers)) {
    for (const [ actionName, actionData ] of objectEntries(actionControllers)) {
      actionsControllersParams[actionName] = getActionControllerParams(accessLevel, actionData)
    }
  }
  return actionsControllersParams
}

function getActionControllerParams (access: AccessLevel, actionData: ActionController) {
  let controller, sanitization, track
  if (typeof actionData === 'function') {
    controller = actionData
  } else {
    ({ controller, sanitization, track } = actionData)
  }
  const controllerParams = { access, controller, sanitization, track }
  validateControllerWrapperParams(controllerParams)
  return controllerParams
}

export function verbAndActionsControllersFactory (verbsAndActionsControllers: VerbsAndActionsControllers) {
  const controllersByVerbsAndActions = {}
  for (const [ verb, actionsControllersParams ] of objectEntries(verbsAndActionsControllers)) {
    controllersByVerbsAndActions[verb] = actionsControllersFactory(actionsControllersParams)
  }
  return controllersByVerbsAndActions
}
