import level from 'level-party'
import { absolutePath } from '#lib/absolute_path'
import { newError } from '#lib/error/error'
import { exists } from '#lib/fs'
import { info } from '#lib/utils/logs'
import config from '#server/config'

const dbFolder = absolutePath('root', 'db')
if (!(await exists(dbFolder))) {
  throw newError('can not find db folder', 500, { dbFolder })
}

const { suffix } = config.db
const { inMemoryLRUCacheSize } = config.leveldb
const generalDbPathBase = `${dbFolder}/leveldb`
const generalDbFolderPath = suffix ? `${generalDbPathBase}-${suffix}` : generalDbPathBase

// See https://github.com/Level/leveldown#options
const leveldownOptions = {
  cacheSize: inMemoryLRUCacheSize,

  // Default is 1024, which causes 'WriteError: "Too many open files"' errors in production
  // Setting it to Infinity lets the operating system fully manage the process limit.
  // The operating system limit of opened files per process should itself be increased
  // as it might also have a low defaults:
  //
  //  echo '* soft nofile 65536\n* hard nofile 65536\n' | sudo tee -a /etc/security/limits.conf
  //
  // (see https://singztechmusings.wordpress.com/2011/07/11/ulimit-how-to-permanently-set-kernel-limits-in-linux/)
  //
  // Additionally, the process itself should be given a higher limit
  // See https://github.com/inventaire/inventaire-deploy/commit/0ad6e2a
  // This limit can be checked by inspecting `cat /proc/${pid}/limits | grep 'Max open files'`
  maxOpenFiles: Infinity,
}

info(generalDbFolderPath, 'leveldb path')
export const generalDb = level(generalDbFolderPath, leveldownOptions)
