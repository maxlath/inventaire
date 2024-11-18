import { makeUrl, getEntityUriFromActorName, getEntityActorName } from '#controllers/activitypub/lib/helpers'
import { getEntityByUri } from '#controllers/entities/lib/remote/instance_agnostic_entities'
import { isEntityUri, isUsername } from '#lib/boolean_validations'
import { ControllerWrapper } from '#lib/controller_wrapper'
import { notFoundError } from '#lib/error/error'
import { publicHost } from '#server/config'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import { validateUser, validateShelf } from './lib/validations.js'

const sanitization = {
  resource: {},
}

async function controller ({ resource }: SanitizedParameters) {
  const name = getActorName(resource)
  if (isEntityUri(getEntityUriFromActorName(name))) {
    const entity = await getEntityByUri({ uri: getEntityUriFromActorName(name) })
    if (entity) return formatWebfinger(getEntityActorName(entity.uri))
  } else if (name.startsWith('shelf-')) {
    await validateShelf(name)
    return formatWebfinger(name)
  } else if (isUsername(name)) {
    const { user } = await validateUser(name)
    return formatWebfinger(user.stableUsername)
  }
  throw notFoundError({ resource, name })
}

export default {
  get: ControllerWrapper({
    access: 'public',
    sanitization,
    controller,
  }),
}

function getActorName (resource) {
  const actorWithHost = resource.slice(5)
  return actorWithHost.split('@')[0]
}

function formatWebfinger (name) {
  const actorUrl = makeUrl({ params: { action: 'actor', name } })

  return {
    subject: `acct:${name}@${publicHost}`,
    aliases: [ actorUrl ],
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: actorUrl,
      },
    ],
  }
}
