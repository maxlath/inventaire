import { methodAndActionsControllersFactory } from '#lib/actions_controllers'
import { buildProxiedControllers } from '#lib/federation/build_proxied_controllers'
import isbn from './isbn.js'
import { propertyValues, propertiesMetadata } from './properties_metadata.js'
import summaries from './summaries.js'
import wpExtract from './wp_extract.js'

const localDataControllersParams = {
  get: {
    public: {
      'wp-extract': wpExtract,
      summaries,
      isbn,
      'property-values': propertyValues,
      properties: propertiesMetadata,
    },
  },
}

export const localDataControllers = methodAndActionsControllersFactory(localDataControllersParams)
export const federatedDataControllers = buildProxiedControllers('/api/tasks', localDataControllersParams)
