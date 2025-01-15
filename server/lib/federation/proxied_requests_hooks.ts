import { getInvEntityUriFromPatchId } from '#controllers/entities/lib/patches/patches'
import { lazyRefreshSnapshotFromUri } from '#controllers/items/lib/snapshot/refresh_snapshot'
import type { RelativeUrl, HttpMethod } from '#types/common'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'

export async function runPostProxiedRequestHooks (method: HttpMethod, url: RelativeUrl, action: string, params?: SanitizedParameters) {
  const endpoint = url.split('?')[0].split('/')[2]
  if (endpoint === 'entities') {
    if ((method === 'get' || method === 'post') && action === 'by-uris') {
      const { uris, refresh } = params
      if (refresh && uris) {
        uris.forEach(lazyRefreshSnapshotFromUri)
      }
    } else if (method === 'put') {
      const { uri, from, to, patch } = params
      if (uri) lazyRefreshSnapshotFromUri(uri)
      if (from) lazyRefreshSnapshotFromUri(from)
      if (to) lazyRefreshSnapshotFromUri(to)
      if (patch) lazyRefreshSnapshotFromUri(getInvEntityUriFromPatchId(patch))
    }
  }
}
