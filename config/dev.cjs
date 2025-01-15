// Custom config for the development server
// This config file will be used if: NODE_ENV=dev
// Override locally in ./local-dev.cjs

/** @typedef { import('../types/types.ts').Config } Config */
/** @typedef { import('type-fest').PartialDeep } PartialDeep */

/** @type {PartialDeep<Config>} */
const config = {
  env: 'dev',
  outgoingRequests: {
    // Allow entity federation between servers on localhost
    rejectPrivateUrls: false,
  },
  dataseed: {
    enabled: true,
  },
  piwik: {
    enabled: false,
  },
  i18n: {
    autofix: true,
  },
}

module.exports = config
