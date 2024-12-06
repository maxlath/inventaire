import { localEntitiesControllersParams } from '#controllers/entities/entities'
import { buildProxiedControllers } from '#lib/federation/proxied_controllers'

export const federatedEntitiesControllers = buildProxiedControllers('/api/entities', localEntitiesControllersParams)
