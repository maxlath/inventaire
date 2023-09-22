import { error_ } from '#lib/error/error'
// TODO: accept ISBN URIs
import inv from './lib/update_inv_claim.js'
import wd from './lib/update_wd_claim.js'

const sanitization = {
  uri: {},
  property: {},
  'old-value': {},
  'new-value': {},
}

const controller = async (params, req) => {
  const { uri, property, oldValue, newValue } = params
  const [ prefix, id ] = uri.split(':')

  const updater = claimUpdatersByPrefix[prefix]
  if (updater == null) {
    throw error_.new(`unsupported uri prefix: ${prefix}`, 400, uri)
  }

  await updater(req.user, id, property, oldValue, newValue)
  return { ok: true }
}

export const claimUpdatersByPrefix = {
  inv,
  wd,
}

export default { sanitization, controller }
