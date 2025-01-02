// Custom config for the API tests server
// This config file will be used if: NODE_ENV=tests-api NODE_APP_INSTANCE=server
// Override locally in ./local-tests-api-server.cjs

/** @typedef { import('../types/types.ts').Config } Config */
/** @typedef { import('type-fest').PartialDeep } PartialDeep */

const testsApiServerConfig = require('./tests-api-server.cjs')

/** @type {PartialDeep<Config>} */
const config = {
  ...testsApiServerConfig,
  env: 'federated-tests',
  // By convention, federated server port = (equivalent default server port + 10)
  port: 3019,
  db: {
    suffix: 'federated-tests',
  },
  federation: {
    remoteEntitiesOrigin: 'http://localhost:3009',
  },
}

module.exports = config
