// Production config
// This config file will be used if: NODE_ENV=production
// Override locally in ./local-production.cjs

/** @typedef { import('../types/types.ts').Config } Config */
/** @typedef { import('type-fest').PartialDeep } PartialDeep */

/** @type {PartialDeep<Config>} */
const config = {
  env: 'production',
  verbose: true,
  publicHostname: 'OVERRIDE',
  publicProtocol: 'https',
  getPublicOrigin: function () {
    return `${this.publicProtocol}://${this.publicHostname}`
  },
  // Let Nginx serve the static files
  // https://github.com/inventaire/inventaire-deploy/blob/main/nginx/inventaire.original.nginx
  serveStaticFiles: false,
  db: {
    username: 'OVERRIDE',
    password: 'OVERRIDE',
    suffix: 'prod',
  },
  i18n: {
    autofix: false,
  },
  mailer: {
    disabled: false,
  },
  activitySummary: {
    disabled: false,
  },
  // Let the alt instance run the jobs
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
  remoteImages: {
    useProdCachedImages: false,
  },
}

module.exports = config
