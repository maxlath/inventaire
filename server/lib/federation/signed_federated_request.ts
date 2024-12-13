import { makeActorKeyUrl } from '#controllers/activitypub/lib/get_actor'
import { signRequest } from '#controllers/activitypub/lib/security'
import { getSharedKeyPair } from '#controllers/activitypub/lib/shared_key_pair'
import { getUserAnonymizableId } from '#controllers/user/lib/anonymizable_user'
import { federatedRequest } from '#lib/federation/federated_requests'
import { instanceActorName } from '#lib/federation/instance'
import { remoteUserHeader } from '#lib/federation/remote_user'
import config from '#server/config'
import type { AbsoluteUrl, RelativeUrl } from '#types/common'
import type { HttpMethod } from '#types/controllers'
import type { AuthentifiedReq } from '#types/server'

const { remoteEntitiesOrigin } = config.federation

export async function signedFederatedRequest (req: AuthentifiedReq, method: HttpMethod, url: RelativeUrl, body: unknown) {
  const remoteUrl = `${remoteEntitiesOrigin}${url}` as AbsoluteUrl
  const userAnonymizableId = await getUserAnonymizableId(req.user)
  const { privateKey, publicKeyHash } = await getSharedKeyPair()
  const headers = signRequest({
    url: remoteUrl,
    method,
    keyId: makeActorKeyUrl(instanceActorName, publicKeyHash),
    privateKey,
    body,
    headers: {
      [remoteUserHeader]: userAnonymizableId,
    },
  })
  return federatedRequest(method, url, { headers, body })
}
