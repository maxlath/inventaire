import { get, pick } from 'lodash-es'
import { dbFactory } from '#db/couchdb/base'
import { getRandomUuid } from '#lib/crypto'
import type { AnonymizableUserId, User, UserId } from '#types/user'
import type { SetRequired } from 'type-fest'

const db = await dbFactory('users')

export async function getUserAnonymizableId (user: User) {
  const refreshedUser = await db.get<User>(user._id)
  if ('anonymizableId' in refreshedUser) return refreshedUser.anonymizableId
  const anonymizableId = getRandomUuid()
  refreshedUser.anonymizableId = anonymizableId
  await db.put(refreshedUser)
  return anonymizableId
}

export type UserWithAnonymizedId = SetRequired<User, 'anonymizableId'>
export async function getUsersByAnonymizedIds (anonymizableIds: AnonymizableUserId[]) {
  return db.getDocsByViewKeys<UserWithAnonymizedId>('byAnonymizableId', anonymizableIds)
}

const deanonymizedAttributes = [ 'username', 'bio', 'picture', 'created' ] as const
type DeanonymizedAttribute = typeof deanonymizedAttributes[number]

export interface AnonymizedUser {
  _id: AnonymizableUserId
  settings: {
    contributions: {
      anonymize: true
    }
  }
}

export interface DeanonymizedUser extends Pick<User, DeanonymizedAttribute> {
  _id: AnonymizableUserId
  settings: {
    contributions: {
      anonymize: false
    }
  }
}

export function anonymizeUser (user: UserWithAnonymizedId) {
  const anonymizeSetting = get(user, 'settings.contributions.anonymize', true)
  if (anonymizeSetting) {
    return {
      _id: user.anonymizableId,
      settings: {
        contributions: {
          anonymize: true,
        },
      },
    } as AnonymizedUser
  } else {
    return {
      _id: user.anonymizableId,
      settings: {
        contributions: {
          anonymize: false,
        },
      },
      ...pick(user, deanonymizedAttributes),
    } as DeanonymizedUser
  }
}
