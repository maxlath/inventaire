import type { SpecialUser } from '#types/user'

export const specialUserDocBase = {
  type: 'special',
  // Data required to avoid crashing users logic
  snapshot: {},
  settings: {
    notifications: {
      global: false,
    },
    contributions: {
      anonymize: false,
    },
  },
} as const

function buildSpecialUserDoc (username, idLastCharacters) {
  const id = `00000000000000000000000000000${idLastCharacters}`
  const specialUser: Omit<SpecialUser, '_rev' | 'stableUsername' | 'roles'> = {
    _id: id,
    anonymizableId: id,
    username,
    ...specialUserDocBase,
  }
  return specialUser
}

export const hardCodedUsers = {
  // A fake user used to sign entities edit generated from dataseed
  // see server/data/dataseed/dataseed.js
  seed: buildSpecialUserDoc('seed', '000'),
  // see server/controllers/entities/lib/update_claims_hooks
  hook: buildSpecialUserDoc('hook', '001'),
  reconciler: buildSpecialUserDoc('reconciler', '002'),
  // used by scripts/update_entities.js
  updater: buildSpecialUserDoc('updater', '003'),
}
