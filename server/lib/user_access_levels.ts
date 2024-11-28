import { uniq } from 'lodash-es'
import type { RemoteUser } from '#lib/federation/remote_user'
import { objectKeys } from '#lib/utils/types'
import type { SpecialUser, User } from '#types/user'

export const rolesByAccess = {
  public: [ 'public', 'authentified', 'dataadmin', 'admin' ] as const,
  authentified: [ 'authentified', 'dataadmin', 'admin' ] as const,
  dataadmin: [ 'dataadmin', 'admin' ] as const,
  admin: [ 'admin' ] as const,
} as const

export const accessLevels = objectKeys(rolesByAccess)

export type AccessLevel = typeof accessLevels[number]

const accessByRoles = {}

for (const access in rolesByAccess) {
  const roles = rolesByAccess[access]
  for (const role of roles) {
    accessByRoles[role] = accessByRoles[role] || []
    accessByRoles[role].push(access)
  }
}

export function getUserAccessLevels (user: User | SpecialUser | RemoteUser): AccessLevel[] {
  if (!user) return []
  const { roles: userRoles } = user
  if (!userRoles || userRoles.length === 0) return []
  if (userRoles.length === 1) return accessByRoles[userRoles[0]]
  return uniq(userRoles.map(role => accessByRoles[role]).flat())
}

export const hasAdminAccess = (user: User | SpecialUser | RemoteUser) => getUserAccessLevels(user).includes('admin')
export const hasDataadminAccess = (user: User | SpecialUser | RemoteUser) => getUserAccessLevels(user).includes('dataadmin')
