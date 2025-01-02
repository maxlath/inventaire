import parseUrl from 'parseurl'
import type { MinimalRemoteUser } from '#lib/federation/remote_user'
import { coloredElapsedTime } from '#lib/time'
import config from '#server/config'
import type { Next, Req, Res } from '#types/server'

const publicOrigin = config.getPublicOrigin()
const { mutedDomains, mutedPath } = config.requestsLogger

// Adapted from https://github.com/expressjs/morgan 1.1.1
export default (req: Req, res: Res, next: Next) => {
  req._startAt = process.hrtime()

  res.on('close', () => {
    if (skip(req)) return
    logRequest(req, res)
  })

  next()
}

function skip (req: Req) {
  // /!\ resources behind the /public endpoint will have their pathname
  // with /public removed: /public/css/app.css will have a pathname=/css/app.css
  // In that case, req._parsedOriginalUrl would be defined to the original /public/css/app.css,
  // but it's also fine to just set 'css' or 'js' as muted domains instead
  const { path, pathname } = parseUrl(req)
  const domain = pathname.split('/')[1]
  return mutedDomains.includes(domain) || mutedPath.includes(path)
}

function logRequest (req: Req, res: Res) {
  const { method, originalUrl: url } = req
  const user = 'user' in req ? req.user : null
  const remoteUser = 'remoteUser' in req ? req.remoteUser as MinimalRemoteUser : null
  const { statusCode: status, finished } = res

  const color = statusCategoryColor[status.toString()[0]]

  // res.finished is set to true once the 'finished' event was fired
  // See https://nodejs.org/api/http.html#http_event_finish
  // Interruption typically happen when the client closes the request,
  // for instance when tests timeout
  const interrupted = finished ? '' : ` ${yellow}CLOSED BEFORE FINISHING`

  let line = `${grey}${method} ${url} ${color}${status}${interrupted} ${grey}${coloredElapsedTime(req._startAt)}${grey}`

  if (user) line += ` - u:${user._id}`
  else if (remoteUser) line += ` - acct:${remoteUser.acct}`

  const { origin, 'user-agent': reqUserAgent } = req.headers
  if (origin != null && origin !== publicOrigin) {
    // Log cross-site requests origin
    line += ` - origin:${origin}`
  } else if (!user && reqUserAgent && !looksLikeABrowserUserAgent(reqUserAgent)) {
    // Log non-browsers requests user agents (especially federated servers)
    line += ` - agent:"${reqUserAgent}"`
  }

  if (status === 302) {
    const location = res.get('location')
    line += ` ${cyan}=> ${grey}${location}`
  }

  line += resetColors
  process.stdout.write(`${line}\n`)
}

// Using escape codes rather than chalk to save a few characters per line
const escape = '\x1b['
const resetColors = `${escape}0m`
const red = `${escape}31m`
const green = `${escape}32m`
const yellow = `${escape}33m`
const cyan = `${escape}36m`
const grey = `${escape}90m`

const statusCategoryColor = {
  5: red,
  4: yellow,
  3: cyan,
  2: green,
  undefined: resetColors,
}

const looksLikeABrowserUserAgent = (str: string) => str.startsWith('Mozilla/5.0')
