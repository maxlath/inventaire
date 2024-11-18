import { compact, escape, identity } from 'lodash-es'
import { getEntityByUri } from '#controllers/entities/lib/remote/instance_agnostic_entities'
import { isNonEmptyString } from '#lib/boolean_validations'
import type { PropertyValueAttachment } from '#types/activity'
import { buildLink, entityUrl, defaultLabel, propertyLabel } from './helpers.js'
import { platforms } from './platforms.js'
import { propertiesDisplay } from './properties_display.js'

const typesWithAttachments = Object.keys(propertiesDisplay)

export default async function (entity) {
  const { claims, type } = entity
  if (!typesWithAttachments.includes(type)) return

  const attachmentsList = propertiesDisplay[type]
  const properties = Object.keys(attachmentsList)
  const attachments = await Promise.all(properties.map(buildAttachment(claims, attachmentsList)))
  return compact(attachments)
}

const buildAttachment = (claims, attachmentsList) => async prop => {
  const claimValues = claims[prop]
  if (!claimValues) return
  const attachment: PropertyValueAttachment = {
    type: 'PropertyValue',
    name: propertyLabel(prop),
    value: null,
  }
  const attachmentValue = await buildAttachmentValues(claimValues, prop, attachmentsList)
  if (attachmentValue && isNonEmptyString(attachmentValue)) {
    attachment.value = attachmentValue
    return attachment
  }
}

async function buildAttachmentValues (claimValues, prop, attachmentsList) {
  const claimType = attachmentsList[prop]
  const attachmentValues = await Promise.all(claimValues.map(buildAttachmentValue(claimType, prop)))
  return compact(attachmentValues).join(', ') || null
}

async function buildEntity ({ claimValue, claimType }) {
  let attachmentValue
  const isWdUri = claimValue && claimValue.startsWith('wd:')
  if (isWdUri) {
    const wdUrl = entityUrl(claimValue)
    const entity = await getEntityByUri({ uri: claimValue })
    const label = defaultLabel(entity)
    attachmentValue = claimType === 'entityString' ? label : buildLinkWrapper({ claimValue: wdUrl, text: label })
  }
  if (attachmentValue) return attachmentValue
}

function buildLinkWrapper (args) {
  const { claimValue, text } = args
  return buildLink(claimValue, text)
}
// only year for now
const buildTime = ({ claimValue }) => parseInt(claimValue.split('-')[0])

function buildPlatform ({ claimValue, prop }) {
  const plateformProp = platforms[prop]
  if (!plateformProp) return
  const { url, text } = plateformProp
  const attachmentValue = buildLinkWrapper({
    claimValue: url(claimValue),
    text: text(claimValue),
  })
  if (attachmentValue) return attachmentValue
}

const claimTypesActions = {
  entity: buildEntity,
  entityString: buildEntity,
  string: identity,
  time: buildTime,
  platform: buildPlatform,
  url: buildLinkWrapper,
}

const buildAttachmentValue = (claimType, prop) => async claimValue => {
  const escapeClaimValue = escape(claimValue) // html urls
  const claimTypeAction = claimTypesActions[claimType]
  if (claimTypeAction) return claimTypeAction({ claimValue: escapeClaimValue, claimType, prop })
}
