// This config file will be used if: NODE_ENV=production NODE_APP_INSTANCE=federated
// Override locally in ./local-production-federated.cjs

/** @typedef { import('../types/types.ts').Config } Config */
/** @typedef { import('type-fest').PartialDeep } PartialDeep */

/** @type {PartialDeep<Config>} */
const config = {
  port: 3016,
  db: {
    follow: {
      freeze: false,
    },
  },
  federation: {
    remoteEntitiesOrigin: 'https://inventaire.io',
    instanceClientCustomization: {
      name: 'fed-inv',
      orgName: 'Example Organization',
      orgUrl: 'https://inventaire.example.org',
    },
  },
  activitySummary: {
    disabled: false,
    maxEmailsPerHour: 20,
  },
  debouncedEmail: {
    disabled: true,
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
  dataseed: {
    enabled: false,
  },
}

module.exports = config
