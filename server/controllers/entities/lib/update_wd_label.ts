import { triggerSubjectEntityCacheRefresh } from '#controllers/entities/lib/entities_relations_temporary_cache'
import { prefixifyWd } from '#controllers/entities/lib/prefix'
import { getWikidataOAuthCredentials, validateWikidataOAuth } from '#controllers/entities/lib/wikidata_oauth'
import { isWdEntityId } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import { newInvalidError } from '#lib/error/pre_filled'
import { isRemoteUser } from '#lib/federation/remote_user'
import type { RemoteUser } from '#lib/federation/remote_user'
import wdEdit from '#lib/wikidata/edit'
import type { Label, WdEntityId } from '#types/entity'
import type { User } from '#types/user'
import type { WikimediaLanguageCode } from 'wikibase-sdk'

export async function updateWdLabel (user: User | RemoteUser, id: WdEntityId, language: WikimediaLanguageCode, value: Label) {
  if (!isWdEntityId(id)) throw newInvalidError('id', id)
  if (isRemoteUser(user)) throw newError('remote users can not update wd label yet', 400)

  validateWikidataOAuth(user)
  const credentials = getWikidataOAuthCredentials(user)

  const res = await wdEdit.label.set({ id, language, value }, { credentials })
  triggerSubjectEntityCacheRefresh(prefixifyWd(id))
  return res
}
