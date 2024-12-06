import parseUrl from 'parseurl'
import { absolutePath } from '#lib/absolute_path'
import { bundleError } from '#lib/error/pre_filled'

const publicFolder = absolutePath('client', 'public')

const indexOptions = {
  root: publicFolder,
  headers: {
    'cache-control': 'no-cache, no-store, must-revalidate',
    // Opt-out from Google FLoC, see https://plausible.io/blog/google-floc
    'permissions-policy': 'interest-cohort=()',
  },
}

export default {
  get: (req, res) => {
    const { pathname } = parseUrl(req)
    const domain = pathname.split('/')[1]
    if (domain === 'api') {
      bundleError(req, res, `GET ${pathname}: api route not found`, 404)
    } else if (domain === 'public') {
      bundleError(req, res, `GET ${pathname}: asset not found`, 404)
    } else if (imageHeader(req)) {
      const err = `GET ${pathname}: wrong content-type: ${req.headers.accept}`
      bundleError(req, res, err, 400)
    } else {
      // the routing will be done on the client side
      res.sendFile('./index.html', indexOptions)
    }
  },

  redirectToApiDoc: (req, res) => res.redirect('https://api.inventaire.io'),

  api: (req, res) => {
    bundleError(req, res, 'wrong API route or http method', 404, {
      method: req.method,
      url: parseUrl(req).href,
    })
  },
}

const imageHeader = req => req.headers.accept?.startsWith('image')
