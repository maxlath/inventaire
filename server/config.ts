import _config from 'config'
import type { Config } from '#types/config'

const config: Config = _config

export const publicOrigin = config.getPublicOrigin()
export const publicHost = publicOrigin.split('://')[1]
export const federatedMode = config.federation.remoteEntitiesOrigin != null

export default config
