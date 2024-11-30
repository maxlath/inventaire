import { map, uniq } from 'lodash-es'
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
  const deanonymizedUsersIds = getDeanonymizedUsersIds(users)
  patches.forEach(patch => {
    if (patch.user === reqUserAcct) return
    if (deanonymizedUsersIds.has(patch.user)) return
    anonymizePatch(patch)
  })
}

function getDeanonymizedUsersIds (users: UserWithAcct[]) {
  const deanonymizedUsersIds = []
  for (const user of users) {
    if (!userShouldBeAnonymized(user)) deanonymizedUsersIds.push(user._id)
  }
  return new Set(deanonymizedUsersIds)
}

function anonymizePatch (patch: Patch) {
  delete patch.user
}
