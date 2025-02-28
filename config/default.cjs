// This config file contains the default values for all environments.
// Override by creating per-environment files following the same structure in this same folder
// The file priority order can be found here https://github.com/node-config/node-config/wiki/Configuration-Files#file-load-order

// For example, create a specific file named `local.cjs`
// which looks like :
//   const config = {
//     instanceName: 'My Inventaire Instance',
//     orgName: 'Example Organization',
//     orgUrl: 'https://inventaire.example.org',
//     contactAddress: 'contact@inventaire.example.org',
//   }

/** @typedef { import('../types/types.ts').Config } Config */

// Summary

// - Instance general information
// - Instance specifics
// - Databases
// - Specific to instances with local entities (i.e. inventaire.io)
// - Logs
// - Emails
// - Other internal services
// - Remote services
// - Storage
// - Test and development environments tweaks

/** @type {Config} */

const config = {
  // Environment definition,
  // set in production.cjs, development.cjs and tests-*.cjs
  env: 'default',

  // ~~~~~~~
  // Instance general information
  // ~~~~~~~
  // As an instance admin, this section values must be changed in config/local.cjs

  // Will be displayed as menu title on large screens
  instanceName: 'My Inventaire Instance',

  // Will be displayed on landing screen
  orgName: 'Example Organization',
  orgUrl: 'https://inventaire.example.org',

  // Users receiving emails from the instance can reply to this
  contactAddress: 'contact@inventaire.example.org',

  // ~~~~~~~
  // Instance specifics
  // ~~~~~~~

  // Displayed in userAgent and in local logs
  softwareName: 'inventaire',

  // Only http is supported: in production, TLS is delegated to Nginx
  // See http://github.com/inventaire/inventaire-deploy
  protocol: 'http',
  hostname: 'localhost',
  port: 3006,

  publicProtocol: 'http',
  publicHostname: 'localhost',
  // Defaults to the port value. Set to null to not have a port specified in the publicOrigin url
  publicPort: undefined,

  // See https://expressjs.com/en/api.html#trust.proxy.options.table
  trustProxy: 'loopback, uniquelocal',

  // To allow fallback between servers, they need to share the same session keys:
  // one should have autoRotateKeys=true and the others autoRotateKeys=false
  autoRotateKeys: true,

  // Force to renew cookies at least every 6 months
  cookieMaxAge: 180 * 24 * 3600 * 1000,
  incomingRequests: {
    logBody: false,
  },

  outgoingRequests: {
    logStart: false,
    logOngoingAtInterval: true,
    ongoingRequestLogInterval: 5000,
    logEnd: true,
    bodyLogLimit: 500,
    baseBanTime: 5000,
    banTimeIncreaseFactor: 4,
    maxBanTime: 24 * 60 * 60 * 1000,
    // Set to 4 or 6 to force the use of IPv4 or IPv6
    ipFamily: undefined,
    rejectPrivateUrls: true,
  },

  federation: {
    // Set to 'https://inventaire.io' in ./local-dev.cjs
    // in order to use inventaire.io entities in development
    remoteEntitiesOrigin: null,
  },

  // ~~~~~~~
  // Databases
  // ~~~~~~~

  // CouchDB settings
  db: {
    protocol: 'http',
    hostname: 'localhost',
    port: 5984,
    username: 'yourcouchdbusername',
    password: 'yourcouchdbpassword',
    suffix: null,
    getOrigin: function () {
      return `${this.protocol}://${this.username}:${this.password}@${this.hostname}:${this.port}`
    },
    getOriginSansAuth: function () {
      return `${this.protocol}://${this.hostname}:${this.port}`
    },
    databaseUrl: function (dbBaseName) {
      return `${this.protocol}://${this.hostname}:${this.port}/${this.name(dbBaseName)}`
    },
    name: function (dbBaseName) {
      if (this.suffix != null) return `${dbBaseName}-${this.suffix}`
      else return dbBaseName
    },
    // Watch couchdb activity. See server/lib/follow.ts
    follow: {
      // Make external indexes restart from the first seq
      reset: false,
      // Allow to activate database events hooks only on certain instances
      // Will always be false when server/lib/server_mode.js#serverMode is false
      freeze: false,
      delay: 5000,
    },
    // logs CouchDB requests parameters
    debug: false,
    backupFolder: 'backups/couchdb',
  },

  leveldb: {
    inMemoryLRUCacheSize: 64 * 1024 ** 2,
    defaultCacheTtl: 365 * 24 * 60 * 60 * 1000,
    ttlCheckFrequency: 60000,
  },

  elasticsearch: {
    origin: 'http://localhost:9200',
    selfSignedCertificate: false,
    updateDelay: 1000,
    minReindexationInterval: 60 * 60 * 1000,
  },

  // ~~~~~~~
  // Logs
  // ~~~~~~~

  verbose: true,

  requestsLogger: {
    // Use to mute some noisy requests or to focus on a specific scope
    // Possible values: [ "js", "css", "img", "api" ]
    mutedDomains: [],
    mutedPath: [
      '/api/reports?action=online',
    ],
  },

  // ~~~~~~~
  // Emails
  // ~~~~~~~

  // parameters for Nodemailer
  mailer: {
    disabled: true,
    // Relies on SMTP: make sure the appropriate ports are not blocked by your server provider
    // - Scaleway: https://community.online.net/t/solved-smtp-connection-blocked/2262/3
    nodemailer: {
      // This would be the `hostname`, but that's what nodemailer `createTransport` function expect as host value
      host: 'smtp.ethereal.email',
      port: 587,
      // Get some username and password at https://ethereal.email/create
      auth: {
        user: 'someusername@ethereal.email',
        pass: 'somepassword',
      },
    },
    initDelay: 10000,
  },

  debouncedEmail: {
    crawlPeriod: 10 * 60 * 1000,
    debounceDelay: 30 * 60 * 1000,
    disabled: false,
  },

  // Regular automatic newletter
  activitySummary: {
    disabled: true,
    disableUserUpdate: false,
    maxEmailsPerHour: 5,
    // the key to find the current news string
    newsKey: 'news_1',
    didYouKnowKeys: [ 1, 2, 4, 5 ],
  },

  // Time of validity for email validation tokens
  tokenDaysToLive: 3,

  // ~~~~~~~
  // Other internal services
  // ~~~~~~~

  i18n: {
    // Developpement purpose: allow to automatically find missing i18n keys to translate
    // It enables the api/i18n endpoint and its i18nMissingKeys controller
    autofix: false,
    srcFolderPath: '../inventaire-i18n/src',
  },

  // Users inventories, shelves, and groups RSS feed configuration
  feed: {
    limitLength: 50,
    image: 'https://inventaire.io/public/icon/120.png',
  },

  // Triggers a report in the user database document
  // when inserting the suspectKeywords during some events
  // (ie: updating user description (called bio), items comments, lists description, etc.)
  // Those reports can then be inspected by a user with admin rights at /users/latest
  spam: {
    suspectKeywords: [
      'SEO',
      'marketing',
      'shopping',
    ],
  },

  // ~~~~~~~
  // Remote services
  // ~~~~~~~

  // See server/data/dataseed/dataseed.js
  // and https://wiki.inventaire.io/wiki/Entities_data#Data_sources
  dataseed: {
    enabled: false,
    origin: 'http://localhost:9898',
  },

  // Analytics service. See http://matomo.org
  matomo: {
    enabled: false,
    endpoint: 'https://yourmatomoendpoint/matomo.php',
    idsite: 1,
    rec: 1,
  },

  // Required to use MapBox tiles within leaflet maps
  // See https://console.mapbox.com/account/access-tokens/
  mapTilesAccessToken: 'youraccesstoken',

  // ~~~~~~~
  // Media storage
  // ~~~~~~~

  // Images stored by all instances: users profil pictures and groups cover images
  // Images stored by instances with local entities (i.e. inventaire.io): book covers
  mediaStorage: {
    images: {
      // In pixels
      maxSize: 1600,
      // 5MB
      maxWeight: 5 * 1024 ** 2,
      checkDelays: {
        update: 2000,
        upload: 5 * 60 * 1000,
      },
    },
    // By default, media are saved locally instead of using a remote
    // object storage service such as OpenStack Swift
    mode: 'local',
    local: {
      // Storage path relative to the project root
      folder: './storage',
    },
    // Swift parameters are required only when mediaStorage mode is set to 'swift'
    swift: {
      username: 'customizedInLocalConfig',
      password: 'customizedInLocalConfig',
      // Auth URL Without the version section, which is hard coded
      // by server/controllers/images/lib/get_swift_token.js
      authUrl: 'https://openstackEndpointToCustomize',
      publicURL: 'https://swiftPublicURL',
      tenantName: '12345678',
      region: 'SBG-1',
    },
  },

  remoteImages: {
    // As resized remote images are not cached in development, each request reaches remote services,
    // typically Wikimedia Commons. By setting this flag to true, the images are taken from the entities host (inventaire.io)
    // which should be much faster as it likely already have those resized images in Nginx cache
    useEntitiesHostCachedImages: true,
  },

  // ~~~~~~~
  // Test and development environments tweaks
  // ~~~~~~~

  snapshotsDebounceTime: 5000,

  // Do not block erronous request during test
  // But does otherwise
  deduplicateRequests: true,

  // Use-case: create test users faster
  useSlowPasswordHashFunction: true,

  // Serve client files, typically used in development
  // while production environment would leave that to a more optimized file server such as Nginx
  serveStaticFiles: true,

  // Override in ./local.js when working offline to prevent trying to fetch remote resources (like images) when possible
  offline: false,

  activitypub: {
    sanitizeUrls: true,
    activitiesDebounceTime: 60 * 1000,
  },

  oauthServer: {
    authorizationCodeLifetimeMs: 5 * 60 * 1000,
  },

  // Depending on the host machine resources and load,
  // one can adjust the waiting time with this multipling factor
  waitFactor: 1,

  // ~~~~~~~
  // Specific to instances with local entities (i.e. inventaire.io)
  // ~~~~~~~

  entitiesRelationsTemporaryCache: {
    checkFrequency: 10 * 60 * 1000,
    ttl: 4 * 60 * 60 * 1000,
  },

  tasks: {
    minimumScoreToAutogenerate: 350,
  },

  // Jobs are stored in LevelDB using https://www.npmjs.com/package/level-jobs
  // See server/db/level/jobs.ts
  jobs: {
    // Allow to collect entities duplicates, only useful for entities host
    'inv:deduplicate': {
      run: true,
    },
    // Build entity popularity, only useful for entities host
    'entity:popularity': {
      run: true,
    },
    // Synchronises wikidata databases of both CouchDB and Elasticsearch
    'wd:entity:indexation': {
      run: true,
    },
    // Post an acitivity to the fediverse
    'post:activity': {
      run: true,
    },
  },

  // Keys for users Wikidata OAuth
  // See: https://www.mediawiki.org/wiki/OAuth/For_Developers
  // REgister to request some tokens:
  // https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration/propose
  wikidataOAuth: {
    consumer_key: 'your-consumer-key',
    consumer_secret: 'your-consumer-secret',
  },

  // Keys for server own OAuth, used to let the server perform automated edits on Wikidata
  // Request tokens at
  // https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration/propose?wpownerOnly=1
  botAccountWikidataOAuth: {
    consumer_key: 'your-consumer-key',
    consumer_secret: 'your-consumer-secret',
    token: 'your-access-key',
    token_secret: 'your-access-secret',
  },

  wikidataEdit: {
    maxlag: undefined,
  },
}

module.exports = config
