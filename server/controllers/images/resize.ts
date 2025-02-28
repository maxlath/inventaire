import { URL } from 'node:url'
import parseUrl from 'parseurl'
import { isFediverseKnownHost } from '#controllers/activitypub/lib/activities'
import { containers } from '#controllers/images/lib/containers'
import { isUrl } from '#lib/boolean_validations'
import { errorHandler } from '#lib/error/error_handler'
import { bundleError, bundleInvalidError } from '#lib/error/pre_filled'
import { assertHostIsNotTemporarilyBanned } from '#lib/requests_temporary_host_ban'
import { responses_ } from '#lib/responses'
import { getHashCode } from '#lib/utils/base'
import config, { mediaStorageEndpoint } from '#server/config'
import type { Hostname } from '#types/common'
import { getResizedImage } from './lib/get_resized_image.js'

const { env } = config
const { offline } = config
const containersList = Object.keys(containers)
const { useEntitiesHostCachedImages } = config.remoteImages

if (env === 'production' && useEntitiesHostCachedImages) {
  throw new Error("useEntitiesHostCachedImages can not be true when env is 'production'")
}

// resized images urls looks like
// /img/#{container}/#{w}x#{h}/(#{hash}|#{external url getHashCode?href=escaped url})"

export default {
  get: async (req, res) => {
    // can be useful in development
    if (offline) {
      const message = 'you are in offline mode: no img delivered'
      responses_.okWarning(res, 'connection', message)
      return
    }

    let [ container, dimensions, rest ] = parseReq(req)

    if (!containersList.includes(container)) {
      return bundleInvalidError(req, res, 'container', container)
    }

    // if no dimensions are passed, should return the maximum dimension
    if (!/\d{2,4}x\d{2,4}/.test(dimensions)) {
      rest = dimensions
      dimensions = null
    }

    let url
    if (/^[0-9a-f]{40}$/.test(rest) || (container === 'assets')) {
      url = `${mediaStorageEndpoint}${container}/${rest}`
    } else if (/^\d+$/.test(rest)) {
      url = req.query.href
      if (!isUrl(url)) {
        return bundleError(req, res, 'invalid href query', 400, url)
      }

      const { host, hostname } = new URL(url)
      try {
        assertHostIsNotTemporarilyBanned(host)
      } catch (err) {
        return errorHandler(req, res, err)
      }

      const rootDomain = getApproximativeRootDomain(hostname)
      const isKnownHostname = await isFediverseKnownHost(rootDomain)
      if (!trustedRemoteHosts.has(hostname) && !isKnownHostname) {
        return bundleError(req, res, 'image domain not allowed', 400, url)
      }

      const urlCode = getHashCode(url).toString()
      // The hashcode can be used by Nginx for caching, while the url is passed
      // as query argument in case it isnt in cache.
      // Here, we just check that we do get the same hash
      if (urlCode !== rest) {
        return bundleError(req, res, 'hash code and href dont match', 400)
      }

      // As resized remote images are not cached in development, each request reaches remote services,
      // typically Wikimedia Commons. By setting useEntitiesHostCachedImages=true, the images are taken from the inventaire.io
      // which should be much faster as it likely already have those resized images in Nginx cache
      if (useEntitiesHostCachedImages) {
        const prodUrl = `https://inventaire.io${req.url}`
        return res.redirect(prodUrl)
      }
    } else {
      return bundleError(req, res, 'invalid image path', 400, rest)
    }

    getResizedImage(req, res, url, dimensions)
  },
}

function parseReq (req) {
  let { pathname } = parseUrl(req)
  pathname = pathname.replace('/img/', '')
  return pathname.split('/')
}

const trustedRemoteHosts = new Set([
  'commons.wikimedia.org',
  'upload.wikimedia.org',
  'covers.openlibrary.org',
  // Assets such as https://inventaire.io/public/images/inventaire-books.jpg are currently served as remote images
  // TODO: move to /img/assets instead
  'inventaire.io',
])

function getApproximativeRootDomain (hostname: Hostname) {
  // From https://gist.github.com/aaronpeterson/8c481deafa549b3614d3d8c9192e3908
  // As many images servers have subdomains: ie. static.mamot.fr
  let parts = hostname.split('.')
  if (parts.length <= 2) return hostname

  parts = parts.slice(-3)
  if ([ 'co', 'com' ].includes(parts[1])) return parts.join('.')

  return parts.slice(-2).join('.')
}
