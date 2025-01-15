// This config file contains the default values for all environments.
// Override by creating per-environment files following the same structure
// in this same folder
// See the config module doc: https://github.com/lorenwest/node-config/wiki/Configuration-Files

/** @typedef { import('../types/types.ts').Config } Config */

const path = require('node:path')

const root = path.resolve(__dirname, '..')
const port = 3006
const contactAddress = 'hello@inventaire.io'

/** @type {Config} */
const config = {
  name: 'inventaire',
  env: 'default',
  // Only http is supported: in production, TLS is delegated to Nginx
  // see http://github.com/inventaire/inventaire-deploy
  // protocol: 'http'
  verbose: true,
  hostname: 'localhost',
  protocol: 'http',
  port,
  // Override in ./local.js when working offline to prevent trying to fetch remote resources (like images) when possible
  offline: false,
  getLocalOrigin: function () {
    return `${this.protocol}://${this.hostname}:${this.port}`
  },
  publicProtocol: 'http',
  publicHostname: 'localhost',
  getPublicOrigin: function () {
    return `${this.publicProtocol}://${this.publicHostname}:${this.port}`
  },
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
    follow: {
      // Make external indexes restart from the first seq
      reset: false,
      // Allow to activate database events hooks only on certain instances
      // Will always be false when server/lib/server_mode.js#serverMode is false
      freeze: false,
      delay: 5000,
    },
    // logs Couchdb requests parameters
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
    updateDelay: 1000,
    minReindexationInterval: 60 * 60 * 1000,
  },

  federation: {
    // Set to 'https://inventaire.io' in ./local-dev.cjs to use inventaire.io entities locally
    remoteEntitiesOrigin: null,
    instanceClientCustomization: {
      name: 'inventaire',
      orgName: 'Example Organization',
      orgUrl: 'https://inventaire.example.org',
    },
  },

  // See server/data/dataseed/dataseed.js
  dataseed: {
    enabled: false,
    origin: 'http://localhost:9898',
  },

  serveStaticFiles: true,

  useSlowPasswordHashFunction: true,
  requestsLogger: {
    // Use to mute certain requests if it gets too noisy or you want to focus on a certain domain
    // Possible values: js, css, img, api
    mutedDomains: [],
    mutedPath: [
      '/api/reports?action=online',
    ],
  },

  i18n: {
    // enable the api/i18n endpoint and its i18nMissingKeys controller
    autofix: false,
    srcFolderPath: '../inventaire-i18n/src',
  },

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
    defaultFrom: `inventaire.io <${contactAddress}>`,
    initDelay: 10000,
  },
  debouncedEmail: {
    crawlPeriod: 10 * 60 * 1000,
    debounceDelay: 30 * 60 * 1000,
    disabled: false,
  },

  contactAddress,
  activitySummary: {
    disabled: true,
    disableUserUpdate: false,
    maxEmailsPerHour: 5,
    // the key to find the current news string
    newsKey: 'news_1',
    didYouKnowKeys: [ 1, 2, 4, 5 ],
  },
  // time of validity for email validation tokens
  tokenDaysToLive: 3,

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
    // object storage service such as Swift
    mode: 'local',
    local: {
      folder: () => `${root}/storage`,
      internalEndpoint: () => `http://localhost:${port}/local/`,
    },
    // Swift parameters are required only when mediaStorage mode is set to 'swift'
    swift: {
      username: 'customizedInLocalConfig',
      password: 'customizedInLocalConfig',
      // Auth URL Without the version section, which is hard coded
      // by server/controllers/images/lib/get_swift_token.js
      authUrl: 'https://openstackEndpointToCustomize',
      publicURL: 'https://swiftPublicURL/',
      tenantName: '12345678',
      region: 'SBG-1',
      internalEndpoint: function () {
        return `${this.publicURL}/`
      },
    },
  },

  remoteImages: {
    // As resized remote images are not cached in development, each request reaches remote services,
    // typically Wikimedia Commons. By setting this flag to true, the images are taken from the inventaire.io
    // which should be much faster as it likely already have those resized images in Nginx cache
    useProdCachedImages: true,
  },

  // Analytics service
  piwik: {
    enabled: false,
    endpoint: 'https://yourpiwikendpoint/piwik.php',
    idsite: 1,
    rec: 1,
  },

  searchTimeout: 10000,

  feed: {
    limitLength: 50,
    image: 'https://inventaire.io/public/icon/120.png',
  },

  deduplicateRequests: true,

  // Keys for users OAuth
  // Doc: https://www.mediawiki.org/wiki/OAuth/For_Developers
  // Request tokens at
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

  snapshotsDebounceTime: 5000,

  jobs: {
    'inv:deduplicate': {
      run: true,
    },
    'entity:popularity': {
      run: true,
    },
    'wd:entity:indexation': {
      run: true,
    },
  },

  // give priority to more urgent matters
  nice: true,

  entitiesRelationsTemporaryCache: {
    checkFrequency: 10 * 60 * 1000,
    ttl: 4 * 60 * 60 * 1000,
  },

  oauthServer: {
    authorizationCodeLifetimeMs: 5 * 60 * 1000,
  },

  activitypub: {
    sanitizeUrls: true,
    activitiesDebounceTime: 60 * 1000,
  },

  spam: {
    suspectKeywords: [
      'SEO',
      'marketing',
      'shopping',
    ],
  },

  mapTilesAccessToken: 'youraccesstoken',

  tasks: {
    minimumScoreToAutogenerate: 350,
  },
  waitFactor: 1,
}

module.exports = config
