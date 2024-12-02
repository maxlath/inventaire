import { oneDay } from '#lib/time'
import type { ResolverEntry } from '#types/resolver'
import type { AuthentifiedReq, RemoteUserAuthentifiedReq, UserAccountUri } from '#types/server'
import { resolveUpdateAndCreate } from './lib/resolver/resolve_update_and_create.js'

// Entry example:
// {
//   edition: {
//     claims: {
//       'wdt:P212': '978-3-7795-0208-1',
//       'wdt:P1680': 'Fragmente einer anarchistischen Anthropologie',
//       'wdt:P648': 'OL26350019M'
//     }
//   },
//   works: [
//     {
//       labels: { en: 'Frei von Herrschaft' },
//       claims: { 'wdt:P50': [ 'wd:Q1174579' ] }
//     }
//   ],
//   authors: [
//     {
//       labels: { en: 'David Graeber' }
//     }
//   ]
// }

const sanitization = {
  entries: {
    generic: 'collection',
  },
  create: {
    generic: 'boolean',
    optional: true,
  },
  update: {
    generic: 'boolean',
    optional: true,
  },
  enrich: {
    generic: 'boolean',
    optional: true,
  },
  strict: {
    generic: 'boolean',
    optional: true,
    default: true,
  },
}

export interface ResolverParams {
  entries: ResolverEntry[]
  create?: boolean
  update?: boolean
  enrich?: boolean
  strict?: boolean
  reqUserAcct?: UserAccountUri
}

async function controller (params: ResolverParams, req: AuthentifiedReq | RemoteUserAuthentifiedReq) {
  req.setTimeout(oneDay)
  const { resolvedEntries, errors } = await resolveUpdateAndCreate(params)
  if (params.strict) {
    return { entries: resolvedEntries }
  } else {
    return {
      entries: resolvedEntries,
      errors: errors.map(formatError),
    }
  }
}

function formatError (err) {
  const { message, entry, context } = err
  if (context === entry) return { message, entry }
  else return { message, context, entry }
}

export default { sanitization, controller }
