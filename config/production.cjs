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
  publicPort: null,
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
  remoteImages: {
    useEntitiesHostCachedImages: false,
  },
}

module.exports = config
