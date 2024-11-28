import { cloneDeep } from 'lodash-es'
import { putInvEntityUpdate } from '#controllers/entities/lib/entities'
import { newError } from '#lib/error/error'
import { emit } from '#lib/radio'
import { setEntityDocLabel } from '#models/entity'
import type { InvEntity, Label } from '#types/entity'
import type { UserAccountUri } from '#types/server'
import { getInvEntityType } from './get_entity_type.js'
import { typeWithoutLabels } from './type_without_labels.js'
import type { WikimediaLanguageCode } from 'wikibase-sdk'

export async function updateLabel (lang: WikimediaLanguageCode, value: Label, userAcct: UserAccountUri, currentDoc: InvEntity) {
  checkEntityTypeCanHaveLabel(currentDoc)

  let updatedDoc = cloneDeep(currentDoc)
  updatedDoc = setEntityDocLabel(updatedDoc, lang, value)
  const docAfterUpdate = await putInvEntityUpdate({ userAcct, currentDoc, updatedDoc })
  await emit('entity:update:label', updatedDoc)
  return docAfterUpdate
}

function checkEntityTypeCanHaveLabel (currentDoc: InvEntity) {
  const type = getInvEntityType(currentDoc.claims['wdt:P31'])

  if (typeWithoutLabels.has(type)) {
    throw newError(`${type}s can't have labels`, 400)
  }
}
