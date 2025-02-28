// Inspired by https://blog.goncharov.page/node-config-made-type-safe

import type { AbsoluteUrl, Origin, Path, RelativeUrl } from '#types/common'
import type { ImagePath } from '#types/image'
import type { Email, OAuthConsumer, OwnerOnlyOAuthConsumer } from '#types/user'
import type { ReadonlyDeep } from 'type-fest'

export type Config = ReadonlyDeep<{
  env: 'default' | 'dev' | 'production' | 'tests' | 'tests-api' | 'tests-integration' | 'tests-unit'

  instanceName: string
  orgName: string
  orgUrl: AbsoluteUrl
  contactAddress: Email

  verbose: boolean
  hostname: string
  protocol: 'http' | 'https'
  port: number
  offline: boolean
  publicProtocol: 'http' | 'https'
  publicHostname: string
  publicPort: number | null
  /** See https://expressjs.com/en/api.html#trust.proxy.options.table */
  trustProxy: string
  autoRotateKeys: boolean
  cookieMaxAge: number
  incomingRequests: {
    logBody: boolean
  }
  outgoingRequests: {
    logStart: boolean
    logOngoingAtInterval: boolean
    ongoingRequestLogInterval: number
    logEnd: boolean
    bodyLogLimit: number
    baseBanTime: number
    banTimeIncreaseFactor: number
    maxBanTime: number
    /** Set to 4 or 6 to force the use of IPv4 or IPv6 */
    ipFamily?: 4 | 6
    rejectPrivateUrls: boolean
  }
  db: {
    protocol: 'http' | 'https'
    hostname: string
    port: number
    username: string
    password: string
    suffix?: string | null
    getOrigin: () => Origin
    getOriginSansAuth: () => Origin
    databaseUrl: (string) => AbsoluteUrl
    name: (string) => string
    follow: {
      /** Make external indexes restart from the first seq */
      reset: boolean
      /** Allows to activate database events hooks only on certain instances
      * Will always be false when server/lib/server_mode.js#serverMode is false */
      freeze: boolean
      delay: number
    }
    /** logs CouchDB requests parameters */
    debug: boolean
    backupFolder: Path
  }

  leveldb: {
    inMemoryLRUCacheSize: number
    defaultCacheTtl: number
    ttlCheckFrequency: number
  }

  elasticsearch: {
    origin: Origin
    selfSignedCertificate: boolean
    updateDelay: number
    minReindexationInterval: number
  }

  federation: {
    remoteEntitiesOrigin: Origin
  }

  // See server/data/dataseed/dataseed.js
  dataseed: {
    enabled: boolean
    origin: Origin
  }

  serveStaticFiles: boolean

  useSlowPasswordHashFunction: boolean
  requestsLogger: {
    // Use to mute certain requests if it gets too noisy or you want to focus on a certain domain
    // Possible values: js, css, img, api
    mutedDomains: string[]
    mutedPath: RelativeUrl[]
  }

  i18n: {
    // enable the api/i18n endpoint and its i18nMissingKeys controller
    autofix: boolean
    srcFolderPath: Path
  }

  mailer: {
    disabled: boolean
    nodemailer: {
      host: string
      port: number
      auth: {
        user: string
        pass: string
      }
    }
    initDelay: number
  }
  activitySummary: {
    disabled: boolean
    disableUserUpdate: boolean
    maxEmailsPerHour: number
    newsKey: `news_${number}`
    didYouKnowKeys: number[]
  }
  // time of validity for email validation tokens
  tokenDaysToLive: number
  debouncedEmail: {
    crawlPeriod: number
    debounceDelay: number
    disabled: boolean
  }

  mediaStorage: {
    images: {
      // In pixels
      maxSize: number
      // 5MB
      maxWeight: number
      checkDelays: {
        update: number
        upload: number
      }
    }
    mode: 'local' | 'swift'
    local: {
      folder?: Path
    }
    swift: {
      username: string
      password: string
      // Auth URL Without the version section, which is hard coded
      // by server/controllers/images/lib/get_swift_token.js
      authUrl: AbsoluteUrl
      publicURL: AbsoluteUrl
      tenantName: string
      region: string
    }
  }

  mocha?: {
    timeout: number
  }

  waitForServer?: boolean

  remoteImages: {
    // As resized remote images are not cached in development, each request reaches remote services,
    // typically Wikimedia Commons. By setting this flag to true, the images are taken from the inventaire.io
    // which should be much faster as it likely already have those resized images in Nginx cache
    useEntitiesHostCachedImages: boolean
  }

  // Analytics service
  matomo: {
    enabled: boolean
    endpoint: AbsoluteUrl
    idsite: number
    rec: number
  }

  feed: {
    limitLength: number
    image: ImagePath
  }

  deduplicateRequests: boolean

  /** Doc: https://www.mediawiki.org/wiki/OAuth/For_Developers
   *  Request tokens at
   *  https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration/propose */
  wikidataOAuth: OAuthConsumer

  /** Keys for server own OAuth
   *  Request tokens at
   *  https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration/propose?wpownerOnly=1 */
  botAccountWikidataOAuth: OwnerOnlyOAuthConsumer

  wikidataEdit: {
    maxlag?: number
  }

  snapshotsDebounceTime: number

  jobs: {
    'inv:deduplicate': {
      run: boolean
    }
    'entity:popularity': {
      run: boolean
    }
    'wd:entity:indexation': {
      run: boolean
    }
    'post:activity': {
      run: boolean
    }
  }

  // give priority to more urgent matters
  nice: boolean

  entitiesRelationsTemporaryCache: {
    checkFrequency: number
    ttl: number
  }

  oauthServer: {
    authorizationCodeLifetimeMs: number
  }

  activitypub: {
    sanitizeUrls: boolean
    activitiesDebounceTime: number
  }

  spam: {
    suspectKeywords: string[]
  }

  mapTilesAccessToken: string

  tasks: {
    minimumScoreToAutogenerate: number
  }

  waitFactor: number
}>
