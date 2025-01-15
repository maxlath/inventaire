import { get, pick } from 'lodash-es'
import { getUserAccessLevels, type AccessLevel } from '#lib/user_access_levels'
import userAttributes from '#models/attributes/user'
import type { DeletedUser, DocWithUsernameInUserDb, SpecialUser, User, UserId } from '#types/user'

type OwnerSafeUserAttribute = typeof userAttributes['ownerSafe'][number]
export interface OwnerSafeUser extends Pick<User, OwnerSafeUserAttribute> {
  enabledOAuth: string[]
  accessLevels: AccessLevel[]
}

// Including the deleted user, as after deleting, it is still possible to make a request
// with the session cookies
export function ownerSafeData (user: User | DeletedUser) {
  if (user.type === 'deleted') return user
  const safeUserDoc: Partial<OwnerSafeUser> = {
    ...pick(user, userAttributes.ownerSafe),
    accessLevels: getUserAccessLevels(user),
  }
  safeUserDoc.enabledOAuth = ('oauth' in user && user.oauth != null) ? Object.keys(user.oauth) : []
  safeUserDoc.roles = safeUserDoc.roles || []
  safeUserDoc.settings = safeUserDoc.settings || {}
  safeUserDoc.settings.notifications = safeUserDoc.settings.notifications || {}
  return safeUserDoc as OwnerSafeUser
}

// Adapts the result to the requester authorization level
export type UserExtraAttribute = 'email' | 'reports'

interface OmitPrivateDataParams {
  networkIds?: UserId[]
  reqUserId?: UserId
  extraAttribute?: UserExtraAttribute
  reqUserHasAdminAccess?: boolean
}

export function omitPrivateData (params: OmitPrivateDataParams) {
  const { extraAttribute, reqUserId, reqUserHasAdminAccess } = params
  let { networkIds } = params
  networkIds ??= []
  const attributes = getAttributes(extraAttribute)
  return (userDoc: DocWithUsernameInUserDb) => {
    if (userDoc.type === 'deleted') return userDoc

    const userId = userDoc._id
    if (userId === reqUserId) {
      // reqUserId is never a special user id
      return ownerSafeData(userDoc as Exclude<DocWithUsernameInUserDb, SpecialUser>)
    }

    const formattedUserDoc = pick(userDoc, attributes)
    const anonymize = get(userDoc, 'settings.contributions.anonymize', true)
    if (reqUserHasAdminAccess || !anonymize) {
      // Sending the anonymizableId allows to request the user's contributions by acct
      formattedUserDoc.anonymizableId = userDoc.anonymizableId
    }

    if ('snapshot' in formattedUserDoc) {
      if ('private' in formattedUserDoc.snapshot) delete formattedUserDoc.snapshot.private
    }

    if (networkIds.includes(userId)) {
      return formattedUserDoc
    } else {
      if ('snapshot' in formattedUserDoc && 'network' in formattedUserDoc.snapshot) {
        delete formattedUserDoc.snapshot.network
      }
      return formattedUserDoc
    }
  }
}

function getAttributes (extraAttribute?: UserExtraAttribute) {
  if (extraAttribute) {
    return [ ...userAttributes.public, extraAttribute ]
  } else {
    return userAttributes.public
  }
}
