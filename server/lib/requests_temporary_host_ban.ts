import { debounce, noop } from 'lodash-es'
import { leveldbFactory } from '#db/level/get_sub_db'
import { newError } from '#lib/error/error'
import type { ContextualizedError } from '#lib/error/format_error'
import { serverMode } from '#lib/server_mode'
import { warn, success, logError, LogError } from '#lib/utils/logs'
import config from '#server/config'
import type { Host } from '#types/common'

const db = leveldbFactory('hosts-bans', 'json')
const { baseBanTime, banTimeIncreaseFactor, maxBanTime } = config.outgoingRequests
// Using port to keep instances data separated
// to avoid overriding data between instances
// TODO: share ban data among instances
const dbKey = config.port

interface BannedHost {
  banTime: number
  expire: EpochTimeStamp
}

type BannedData = Record<Host, BannedHost>

const banData: BannedData = {
  // 'openlibrary.org': {
  //   banTime: 600_000,
  //   expire: Date.now() + 600_000,
  // },
}

function restoreBanData () {
  db.get(dbKey)
  .then(restoreNonExpiredBans)
  .catch(err => {
    if (err.name === 'NotFoundError') return warn('no hosts bans data found')
    else logError(err, 'hosts bans init err')
  })
}

function restoreNonExpiredBans (data: BannedData) {
  const now = Date.now()
  Object.keys(data).forEach(host => {
    const hostData = data[host]
    if (hostData.expire > now) banData[host] = data[host]
  })
  if (Object.keys(banData).length > 0) success(banData, 'hosts bans data restored')
}

export function assertHostIsNotTemporarilyBanned (host: Host) {
  const hostBanData = banData[host]
  if (hostBanData != null && Date.now() < hostBanData.expire) {
    throw newError(`temporary ban: ${host}`, 500, { host, hostBanData })
  }
}

export function resetBanData (host: Host) {
  delete banData[host]
  lazyBackup()
}

interface ConditionallyDeclareHostErrorOptions {
  noHostBanOnTimeout?: boolean
}

export function conditionallyDeclareHostError (host: Host, err: ContextualizedError, options: ConditionallyDeclareHostErrorOptions = {}) {
  if (err.type === 'request-timeout') {
    if (!options.noHostBanOnTimeout) declareHostError(host)
  } else if (err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || err.code === 'ECONNREFUSED') {
    declareHostError(host)
  }
}

export function declareHostError (host: Host) {
  // Never ban local services
  if (host.startsWith('localhost')) return

  let hostBanData = banData[host]

  if (hostBanData) {
    // Prevent several simulateous requests to all multiply the ban time
    // while the service might actually only have been down for a short while
    if (Date.now() < hostBanData.expire) return
    // This host persists to timeout: renew and increase ban time
    hostBanData.banTime = Math.min(hostBanData.banTime * banTimeIncreaseFactor, maxBanTime)
    hostBanData.expire = getExpireTime(hostBanData.banTime)
  } else {
    hostBanData = banData[host] = {
      banTime: baseBanTime,
      expire: getExpireTime(baseBanTime),
    }
  }

  lazyBackup()
}

const getExpireTime = (banTime: number) => Date.now() + banTime

function backup () {
  db.put(dbKey, banData)
  // .then(() => success('hosts bans data backup'))
  .catch(LogError('hosts bans data backup err'))
}

const lazyBackup = serverMode ? debounce(backup, 60 * 1000) : noop

if (serverMode) restoreBanData()
