// An endpoint to list entities edits made by a user
import { getPatchesByDate, getPatchesByUserAcct, getPatchesByUserAcctAndFilter } from '#controllers/entities/lib/patches/patches'
import { isPropertyUri, isLang } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import { getUserByAcct } from '#lib/federation/remote_user'
import { hasAdminAccess } from '#lib/user_access_levels'
import { userShouldBeAnonymized } from '#models/user'
import type { SanitizedParameters } from '#types/controllers_input_sanitization_parameters'
import type { AuthentifiedReq, UserAccountUri } from '#types/server'
import { anonymizePatches } from './lib/anonymize_patches.js'

const sanitization = {
  user: {
    type: 'acct',
    optional: true,
  },
  limit: { default: 100, max: 1000 },
  offset: { default: 0 },
  filter: {
    generic: 'string',
    optional: true,
  },
}

async function controller (params: SanitizedParameters, req: AuthentifiedReq) {
  const { userAcct, limit, offset, filter, reqUserAcct } = params
  const reqUserHasAdminAccess = hasAdminAccess(req.user)

  if (filter != null && !(isPropertyUri(filter) || isLang(filter))) {
    throw newError('invalid filter', 400, params)
  }

  if (userAcct != null && !reqUserHasAdminAccess) await checkPublicContributionsStatus({ userAcct, reqUserAcct })

  const patchesPage = await getPatchesPage({ userAcct, limit, offset, filter })
  const { patches } = patchesPage
  if (!reqUserHasAdminAccess) await anonymizePatches({ patches, reqUserAcct })

  return patchesPage
}

async function getPatchesPage ({ userAcct, limit, offset, filter }: { userAcct: UserAccountUri, limit: number, offset: number, filter: string }) {
  if (userAcct != null) {
    if (filter != null) {
      return getPatchesByUserAcctAndFilter({ userAcct, filter, limit, offset })
    } else {
      return getPatchesByUserAcct({ userAcct, limit, offset })
    }
  } else {
    return getPatchesByDate({ limit, offset })
  }
}

async function checkPublicContributionsStatus ({ userAcct, reqUserAcct }) {
  if (userAcct === reqUserAcct) return
  const user = await getUserByAcct(userAcct)
  if (userShouldBeAnonymized(user)) {
    throw newError('non-public contributions', 403, { userAcct, reqUserAcct })
  }
}

export default { sanitization, controller }
