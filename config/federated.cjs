/** @typedef { import('../types/types.ts').Config } Config */
/** @typedef { import('type-fest').PartialDeep } PartialDeep */

/** @type {PartialDeep<Config>} */
const config = {
  env: 'federated',
  // By convention, federated server port = (equivalent default server port + 10)
  port: 3016,
  db: {
    suffix: 'federated',
  },
  federation: {
    remoteEntitiesOrigin: 'http://localhost:3006',
    instanceClientCustomization: {
      name: 'fed-inv',
      orgName: 'Example Organization',
      orgUrl: 'https://inventaire.example.org',
    },
  },
  dataseed: {
    enabled: false,
  },
  mailer: {
    disabled: true,
  },
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
  nice: false,
}

module.exports = config
