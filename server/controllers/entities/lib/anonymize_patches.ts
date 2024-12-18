import { map, property, uniq } from 'lodash-es'
import { getUsersByAccts, type UserWithAcct } from '#lib/federation/remote_user'
import { userShouldBeAnonymized } from '#models/user'
import type { Patch } from '#types/patch'
import type { UserAccountUri } from '#types/server'

interface AnonymizePatchesParams {
  patches: Patch[]
  reqUserAcct: UserAccountUri
}

export async function anonymizePatches ({ patches, reqUserAcct }: AnonymizePatchesParams) {
  const usersAccts = uniq(map(patches, 'user'))
  const users = await getUsersByAccts(usersAccts)
  const deanonymizedUsersAccts = getDeanonymizedUsersAccts(users)
  patches.forEach(patch => {
    if (patch.user === reqUserAcct) return
    if (deanonymizedUsersAccts.has(patch.user)) return
    anonymizePatch(patch)
  })
}

function getDeanonymizedUsersAccts (users: UserWithAcct[]) {
  const deanonymizedUsersAccts = users
    .filter(user => !userShouldBeAnonymized(user))
    .map(property('acct'))
  return new Set(deanonymizedUsersAccts)
}

function anonymizePatch (patch: Patch) {
  delete patch.user
}
