import { localTasksControllersParams } from '#controllers/tasks/tasks'
import { buildProxiedControllers } from '#lib/federation/proxied_controllers'

export const federatedTasksControllers = buildProxiedControllers('/api/tasks', localTasksControllersParams)
