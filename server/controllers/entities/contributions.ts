// An endpoint to list entities edits made by a user
import { getPatchesByDate, getPatchesByUserId, getPatchesByUserIdAndFilter } from '#controllers/entities/lib/patches/patches'
import { getUserById } from '#controllers/user/lib/user'
import { isPropertyUri, isLang } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import { hasAdminAccess } from '#lib/user_access_levels'
import { userShouldBeAnonymized } from '#models/user'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import type { AuthentifiedReq, UserAccountUri } from '#types/server'
import { anonymizePatches } from './lib/anonymize_patches.js'

const sanitization = {
  acct: { optional: true },
  limit: { default: 100, max: 1000 },
  offset: { default: 0 },
  filter: {
    generic: 'string',
    optional: true,
  },
}

async function controller (params: SanitizedParameters, req: AuthentifiedReq) {
  const { acct, limit, offset, filter, reqUserAcct } = params
  const reqUserHasAdminAccess = hasAdminAccess(req.user)

  if (filter != null && !(isPropertyUri(filter) || isLang(filter))) {
    throw newError('invalid filter', 400, params)
  }

  if (acct != null && !reqUserHasAdminAccess) await checkPublicContributionsStatus({ acct, reqUserAcct })

  const patchesPage = await getPatchesPage({ acct, limit, offset, filter })
  const { patches } = patchesPage
  if (!reqUserHasAdminAccess) await anonymizePatches({ patches, reqUserAcct })

  return patchesPage
}

async function getPatchesPage ({ acct, limit, offset, filter }: { acct: UserAccountUri, limit: number, offset: number, filter: string }) {
  if (acct != null) {
    if (filter != null) {
      return getPatchesByUserIdAndFilter({ acct, filter, limit, offset })
    } else {
      return getPatchesByUserId({ acct, limit, offset })
    }
  } else {
    return getPatchesByDate({ limit, offset })
  }
}

async function checkPublicContributionsStatus ({ acct, reqUserAcct }) {
  if (acct === reqUserAcct) return
  const user = await getUserById(acct)
  if (userShouldBeAnonymized(user)) {
    throw newError('non-public contributions', 403, { acct })
  }
}

export default { sanitization, controller }
