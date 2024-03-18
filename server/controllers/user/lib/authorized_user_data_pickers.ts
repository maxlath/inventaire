import { pick } from 'lodash-es'
import { getUserAccessLevels, type rolesByAccess } from '#lib/user_access_levels'
import userAttributes from '#models/attributes/user'
import type { DocWithUsernameInUserDb, User, UserId } from '#types/user'

interface OwnerSafeUser extends Pick<User, typeof userAttributes['ownerSafe'][number]> {
  oauth?: string[]
  accessLevels: typeof rolesByAccess['public'][number]
}

export function ownerSafeData (user: User) {
  const safeUserDoc: OwnerSafeUser = {
    ...pick(user, userAttributes.ownerSafe),
    accessLevels: getUserAccessLevels(user),
  }
  safeUserDoc.oauth = ('oauth' in user && user.oauth != null) ? Object.keys(user.oauth) : []
  safeUserDoc.roles = safeUserDoc.roles || []
  if (user.type !== 'deletedUser') {
    safeUserDoc.settings = safeUserDoc.settings || {}
    safeUserDoc.settings.notifications = safeUserDoc.settings.notifications || {}
  }
  return safeUserDoc as OwnerSafeUser
}

// Adapts the result to the requester authorization level
export type UserExtraAttribute = 'email'

export function omitPrivateData (reqUserId?: UserId, networkIds = [], extraAttribute?: UserExtraAttribute) {
  const attributes = getAttributes(extraAttribute)
  return (userDoc: DocWithUsernameInUserDb) => {
    if (userDoc.type === 'deletedUser') return userDoc

    const userId = userDoc._id
    if (userId === reqUserId) return ownerSafeData(userDoc)

    const formatttedUserDoc = pick(userDoc, attributes)
    if ('snapshot' in formatttedUserDoc) {
      if ('private' in formatttedUserDoc.snapshot) delete formatttedUserDoc.snapshot.private
    }

    if (networkIds.includes(userId)) {
      return formatttedUserDoc
    } else {
      if ('snapshot' in formatttedUserDoc && 'network' in formatttedUserDoc.snapshot) {
        delete formatttedUserDoc.snapshot.network
      }
      return formatttedUserDoc
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
