import { getInvEntitiesByClaim } from '#controllers/entities/lib/entities'
import getInvEntityCanonicalUri from '#controllers/entities/lib/get_inv_entity_canonical_uri'
import { normalizeTitle } from '#controllers/entities/lib/resolver/helpers'
import type { Claims } from '#types/entity'
import type { Entries } from 'type-fest'

export default async function (editionSeed, worksSeeds) {
  if (editionSeed.uri) return
  // Only edition seeds with no known isbns can be resolved this way
  if (editionSeed.isbn) return
  const editionSeedTitle = getNormalizedTitle(editionSeed)
  // We need a title to resolve with existing editions
  if (editionSeedTitle == null) return
  if (worksSeeds.length !== 1) return
  const { uri: workUri } = worksSeeds[0]
  if (workUri == null) return
  const editions = await getInvEntitiesByClaim('wdt:P629', workUri, true, true)
  const matchingEditions = editions.filter(isMatchingEdition(editionSeed, editionSeedTitle))
  if (matchingEditions.length === 1) {
    const matchingEdition = matchingEditions[0]
    editionSeed.uri = getInvEntityCanonicalUri(matchingEdition)
  }
}

const isMatchingEdition = (editionSeed, editionSeedTitle) => edition => {
  const title = getNormalizedTitle(edition)
  const titlesMatch = editionSeedTitle.includes(title) || title.includes(editionSeedTitle)
  const claimsDoNotContradict = editionSeedHasNoContradictingClaim(editionSeed, edition)
  return titlesMatch && claimsDoNotContradict
}

function getNormalizedTitle ({ claims }) {
  const title = claims['wdt:P1476']?.[0]
  if (title) return normalizeTitle(title)
}

function editionSeedHasNoContradictingClaim (editionSeed, edition) {
  for (const [ property, propertyClaims ] of Object.entries(editionSeed.claims) as Entries<Claims>) {
    if (!ignoredProperties.includes(property)) {
      for (const value of propertyClaims) {
        if (!edition.claims[property]?.includes(value)) {
          return false
        }
      }
    }
  }
  return true
}

const ignoredProperties = [
  // The title is already checked in a more tolerant fashion
  'wdt:P1476',
]
