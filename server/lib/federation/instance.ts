import { makeActorKeyUrl, makeActorUrl } from '#controllers/activitypub/lib/get_actor'
import { context } from '#controllers/activitypub/lib/helpers'
import { getSharedKeyPair } from '#controllers/activitypub/lib/shared_key_pair'

const instanceActorName = 'instance'
const instanceActorUrl = makeActorUrl(instanceActorName)

let instanceActor
export async function getInstanceActor () {
  if (!instanceActor) {
    const { publicKey, publicKeyHash } = await getSharedKeyPair()
    instanceActor = {
      '@context': context,
      // See https://www.w3.org/TR/activitystreams-vocabulary/#actor-types
      // and https://www.w3.org/wiki/Activity_Streams/Primer/Service_type
      type: 'Service',
      id: instanceActorUrl,
      publicKey: {
        id: makeActorKeyUrl(instanceActorName, publicKeyHash),
        owner: instanceActorUrl,
        publicKeyPem: publicKey,
      },
    }
  }
  return instanceActor
}
