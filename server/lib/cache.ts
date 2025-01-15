import { promisify } from 'node:util'
import levelTtl from 'level-ttl'
import { map } from 'lodash-es'
import { leveldbFactory } from '#db/level/get_sub_db'
import { isNonEmptyString } from '#lib/boolean_validations'
import { newError, catchNotFound } from '#lib/error/error'
import type { ContextualizedError } from '#lib/error/format_error'
import { forceArray } from '#lib/utils/base'
import { warn, logError } from '#lib/utils/logs'
import config from '#server/config'

const cacheDb = leveldbFactory('cache', 'utf8')

const { ttlCheckFrequency, defaultCacheTtl } = config.leveldb
const db = levelTtl(cacheDb, { checkFrequency: ttlCheckFrequency, defaultTTL: defaultCacheTtl })
// const dbPut = promisify(db.put)
const dbBatch = promisify(db.batch)
const dbGetMany = promisify(db.getMany.bind(db))
// It's convenient in tests to have the guaranty that the cached value was saved
// but in production, that means delaying API responses in case LevelDB writes get slow
const alwaysWaitForSavedValue = config.env.includes('tests')

interface CacheGetCommonParams {
  refresh?: boolean
  ttl?: number
}

interface CacheGetParams <T> extends CacheGetCommonParams {
  key: string
  fn: () => Promise<T>
  dry?: boolean
  dryFallbackValue?: T
}

interface CacheGetDryParams <T> extends CacheGetCommonParams {
  key: string
  fn?: () => Promise<T>
  dry: boolean
  dryFallbackValue?: T
}

interface CacheGetManyParams <T, Args> extends CacheGetCommonParams {
  keysAndArgs: [ string, Args ][]
  fn: (...Args) => Promise<T>
  dry?: boolean
  dryFallbackValue?: T
}

/**
 * - key: the cache key
 * - fn: a function with its context and arguments binded
 * - refresh: force a cache miss
 * - dry: return what's in cache or nothing: if the cache is empty, do not call the function
 * - dryFallbackValue: the value to return when no cached value can be found, to keep responses type consistent
 * - ttl: customize how long the cached data should be kept before being deleted
 */
async function cacheGet <T> ({ key, fn, refresh, dry, dryFallbackValue, ttl = defaultCacheTtl }: CacheGetParams<T> | CacheGetDryParams<T>): Promise<T> {
  if (refresh) dry = false
  if (dry == null) dry = false

  try {
    const cachedValue = refresh ? null : await checkCache(key)
    return await requestOnlyIfNeeded(key, cachedValue, fn, dry, dryFallbackValue, ttl)
  } catch (err) {
    logCachePopulationError(key, err)
    throw err
  }
}

async function cacheGetMany <T, Args extends unknown[]> ({ keysAndArgs, fn, refresh, dry, dryFallbackValue, ttl = defaultCacheTtl }: CacheGetManyParams<T, Args>): Promise<T[]> {
  if (refresh) dry = false
  if (dry == null) dry = false
  const keys = map(keysAndArgs, '0')
  let cachedValues
  if (refresh) {
    cachedValues = keys.map(() => undefined)
  } else {
    cachedValues = await dbGetMany(keys)
  }
  const keyValuePairsToCache = []
  const cachedAndNewValues = await Promise.all(cachedValues.map(async (cachedValue, i) => {
    if (cachedValue != null) {
      return JSON.parse(cachedValue)
    } else if (dry) {
      return dryFallbackValue
    } else {
      const [ key, args ] = keysAndArgs[i]
      try {
        const res = await fn(...args)
        keyValuePairsToCache.push([ key, res ])
        return res
      } catch (err) {
        logCachePopulationError(key, err)
        // Returning undefined in case of error, thus the need to compact
      }
    }
  }))
  if (keyValuePairsToCache.length > 0) {
    await putValues(keyValuePairsToCache, { ttl, waitWrite: false })
  }
  // Do not use lodash `compact` function, as it also remove other falsy values
  return cachedAndNewValues.filter(value => value != null)
}

export const cache_ = {
  get: cacheGet,

  dryGetMany: async (keys: string[]) => {
    return dbGetMany(keys)
  },

  getMany: cacheGetMany,

  put: async (key, value, ttl = defaultCacheTtl) => {
    if (!isNonEmptyString(key)) throw newError('invalid key', 500)
    if (value == null) throw newError('missing value', 500)
    return putValue(key, value, { ttl })
  },

  batchPut: async (entries: [ string, string ][]) => {
    const batch = entries.map(([ key, value ]) => ({ type: 'put', key, value }))
    return dbBatch(batch)
  },

  batchDelete: keys => {
    const batch = forceArray(keys).map(key => ({ type: 'del', key }))
    return dbBatch(batch)
  },
}

async function checkCache (key) {
  return db.get(key)
  .catch(catchNotFound)
}

function requestOnlyIfNeeded (key, cachedValue, fn, dry, dryFallbackValue, ttl) {
  if (cachedValue != null) {
    // info(`from cache: ${key}`)
    return JSON.parse(cachedValue)
  }

  if (dry) {
    // info(`empty cache on dry get: ${key}`)
    return dryFallbackValue
  }

  return populate(key, fn, ttl)
}

async function populate (key, fn, ttl) {
  const res = await fn()
  // info(`from remote data source: ${key}`)
  await putValue(key, res, { ttl, waitWrite: false })
  return res
}

interface PutValuesOptions {
  ttl?: number
  waitWrite?: boolean
}
async function putValues (keysValues: [ string, unknown ][], { ttl, waitWrite = true }: PutValuesOptions) {
  const batchOps = keysValues.map(([ key, value ]) => {
    // undefined can not be stringified
    if (value === undefined) value = null
    // Run JSON.stringify/JSON.parse rather than using level valueEncoding=json option
    // to be able to store null values and avoid `[WriteError]: value cannot be `null` or `undefined``
    const storedValue = JSON.stringify(value)
    return { type: 'put', key, value: storedValue }
  })
  if (alwaysWaitForSavedValue || waitWrite) {
    return dbBatch(batchOps, { ttl })
  } else {
    dbBatch(batchOps, { ttl })
    // Failing to put the response in cache should not crash the process
    // as it is not critical: operations will continue without cache
    // everything will just be slower
    // Known case of WriteError: when "Too many open files"
    // Solutions:
    //   - restart process
    //   - increase leveldown `maxOpenFiles` option (see https://github.com/Level/leveldown#options)
    .catch(err => {
      const keys = map(keysValues, '0')
      logError(err, `cache populate err: ${keys.join('|')}`)
    })
  }
}

async function putValue (key: string, value: unknown, { ttl, waitWrite = true }: PutValuesOptions) {
  return putValues([ [ key, value ] ], { ttl, waitWrite })
}

function logCachePopulationError (key: string, err: ContextualizedError) {
  const label = `final cache_ err: ${key}`
  // not logging the stack trace in case of 404 and alikes
  if (err.statusCode?.toString().startsWith('4')) warn(err, label)
  else logError(err, label)
}
