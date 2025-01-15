import getActor from '#controllers/activitypub/lib/get_actor'
import getActorHtmlUrl from '#controllers/activitypub/lib/get_actor_html_url'
import { setActivityPubContentType } from '#controllers/activitypub/lib/helpers'
import { getInstanceActor } from '#lib/federation/instance'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import type { Req, Res } from '#types/server'

const sanitization = {
  name: {},
}

async function controller (params: SanitizedParameters, req: Req, res: Res) {
  const { name } = params
  const { accept = '' } = req.headers
  if (name === 'instance') {
    setActivityPubContentType(res)
    return getInstanceActor()
  }
  // TODO: detect cases where text/html is preceded by application/json
  const prefersHtml = accept.includes('text/html')
  if (prefersHtml) {
    const actorUrl = getActorHtmlUrl(name)
    res.redirect(actorUrl)
  } else {
    setActivityPubContentType(res)
    return getActor(name)
  }
}

export default {
  sanitization,
  controller,
}
