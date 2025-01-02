// Common config for the API tests server and the mocha process
// This config file will be used if: NODE_ENV=tests-unit
// Override locally in ./local-tests-unit.cjs

/** @typedef { import('../types/types.ts').Config } Config */
/** @typedef { import('type-fest').PartialDeep } PartialDeep */

/** @type {PartialDeep<Config>} */
const config = {
  env: 'tests-unit',
  verbose: false,
  leveldb: {
    ttlCheckFrequency: 100,
  },
  useSlowPasswordHashFunction: false,
}

module.exports = config
