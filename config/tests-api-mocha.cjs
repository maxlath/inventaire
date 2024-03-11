// Custom config for the API tests mocha process
// This config file will be used if: NODE_ENV=tests-api NODE_APP_INSTANCE=mocha
// Override locally in ./local-tests-api-mocha.js

/** @typedef { import('../types/types.ts').Config } Config */
/** @typedef { import('type-fest').PartialDeep } PartialDeep */

/** @type {PartialDeep<Config>} */
const config = {
  waitForServer: true,

  mocha: {
    // Fit to match the needs of the slowest API,
    // but can most of the time be overriden in ./local.js config with a lower value
    timeout: 20000,
  },

  jobs: {
    'inv:deduplicate': {
      run: false,
    },
    'entity:popularity': {
      run: false,
    },
    'wd:entity:indexation': {
      run: false,
    },
  },
}

module.exports = config
