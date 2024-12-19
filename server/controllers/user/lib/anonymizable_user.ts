import { get, pick } from 'lodash-es'
import { dbFactory } from '#db/couchdb/base'
import type { RemoteUserWithAcct } from '#lib/federation/remote_user'
import type { UserAccountUri } from '#types/server'
import type { AnonymizableUserId, DeletedUser, DocWithAnonymizableId, SpecialUser, User, UserRole } from '#types/user'

const db = await dbFactory('users')

export async function getUsersByAnonymizedIds (anonymizableIds: AnonymizableUserId[]) {
  return db.getDocsByViewKeys<DocWithAnonymizableId>('byAnonymizableId', anonymizableIds)
}

export const deanonymizedAttributes = [ 'username', 'bio', 'picture', 'created', 'roles' ] as const
export type DeanonymizedAttribute = typeof deanonymizedAttributes[number]

export interface AnonymizedUser {
  anonymizableId: AnonymizableUserId
  // Turn the user deleted timestamp into a boolean to be able to share it publicly without making it a deanonymizing factor
  deleted?: boolean
  settings: {
    contributions: {
      anonymize: true
    }
  }
}

export interface DeanonymizedUser extends Pick<User, DeanonymizedAttribute> {
  anonymizableId: AnonymizableUserId
  special?: boolean
  // Turn the user deleted timestamp into a boolean for consistency with AnonymizedUser
  deleted?: boolean
  settings: {
    contributions: {
      anonymize: false
    }
  }
}

export interface AnonymizeUserOptions {
  reqUserHasAdminAccess?: boolean
}

export function anonymizeUser (user: User | DeletedUser | SpecialUser | RemoteUserWithAcct, options: AnonymizeUserOptions = {}) {
  const { reqUserHasAdminAccess } = options
  const anonymizeSetting = get(user, 'settings.contributions.anonymize', true)
  if (anonymizeSetting && !reqUserHasAdminAccess) {
    return buildAnonymizedUser(user)
  } else {
    return {
      ...pick(user, deanonymizedAttributes),
      anonymizableId: user.anonymizableId,
      special: 'type' in user && user.type === 'special' ? true : undefined,
      deleted: 'deleted' in user ? true : undefined,
      settings: {
        contributions: {
          anonymize: anonymizeSetting,
        },
      },
    } as DeanonymizedUser
  }
}

export function buildAnonymizedUser (user: User | DeletedUser | RemoteUserWithAcct | { anonymizableId: AnonymizableUserId }) {
  return {
    anonymizableId: user.anonymizableId,
    deleted: 'deleted' in user ? true : undefined,
    settings: {
      contributions: {
        anonymize: true,
      },
    },
  } as AnonymizedUser
}

export interface InstanceAgnosticContributor extends Pick<User, 'settings'>, Partial<Pick<User, DeanonymizedAttribute>> {
  acct: UserAccountUri
  roles: UserRole[]
  found: boolean
  special?: boolean
  deleted?: boolean
}
