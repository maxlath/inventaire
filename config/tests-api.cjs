// Common config for the API tests server and the mocha process
// This config file will be used if: NODE_ENV=tests-api
// Override locally in ./local-tests-api.cjs

/** @typedef { import('../types/types.ts').Config } Config */
/** @typedef { import('type-fest').PartialDeep } PartialDeep */

const port = 3009

/** @type {PartialDeep<Config>} */
const config = {
  env: 'tests-api',
  protocol: 'http',
  hostname: 'localhost',
  port,
  verbose: false,
  getLocalOrigin: function () {
    return `${this.protocol}://${this.hostname}:${this.port}`
  },
  db: {
    suffix: 'tests',
    // debug: true
    follow: {
      reset: true,
      freeze: false,
      // Give 1000 delay so that tests relying on follow don't have to wait
      delay: 1000,
    },
  },

  outgoingRequests: {
    bodyLogLimit: 2000,
  },

  mediaStorage: {
    images: {
      checkDelays: {
        update: 200,
        upload: 1000,
      },
    },
    local: {
      internalEndpoint: () => `http://localhost:${port}/local/`,
    },
  },

  // Makes tests run faster
  useSlowPasswordHashFunction: false,
  piwik: {
    enabled: false,
  },
  dataseed: {
    enabled: false,
  },
  deduplicateRequests: false,
  mailer: {
    disabled: true,
  },

  snapshotsDebounceTime: 500,

  oauthServer: {
    authorizationCodeLifetimeMs: 1000,
  },

  activitypub: {
    sanitizeUrls: false,
    activitiesDebounceTime: 500,
  },
}

module.exports = config
