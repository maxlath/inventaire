import { ownerSafeData } from '#controllers/user/lib/authorized_user_data_pickers'
import { errorHandler } from '#lib/error/error_handler'
import passport_ from '#lib/passport/passport'
import { sanitize, validateSanitization } from '#lib/sanitize/sanitize'
import setLoggedInCookie from './lib/set_logged_in_cookie.js'

const signupSanitization = validateSanitization({
  username: {},
  email: {},
  password: {},
})

export function logoutRedirect (redirect, req, res) {
  res.clearCookie('loggedIn')
  req.logout()
  res.redirect(redirect)
}

// TODO: rate limit to 10 signup per IP per 10 minutes
export function signup (req, res) {
  // Use sanitize to format and validate body parameters
  req.body = sanitize(req, res, signupSanitization)
  const next = loggedIn(req, res)
  passport_.authenticate.localSignup(req, res, next)
}

export function login (req, res) {
  // Not using sanitize as an email can be passed in place of a username,
  // but still by using the key 'username', and would thus be rejected at sanitization
  const next = loggedIn(req, res)
  passport_.authenticate.localLogin(req, res, next)
}

export const logout = logoutRedirect.bind(null, '/')

const loggedIn = (req, res) => result => {
  if (result instanceof Error) return errorHandler(req, res, result)

  setLoggedInCookie(res)
  const data = { ok: true }
  // add a 'include-user-data' option to access user data directly from the login request
  // Use case: inventaire-wiki (jingo) login
  // https://github.com/inventaire/jingo/blob/635f5417b7ca5a99bad60b32c1758ccecd0e3afa/lib/auth/local-strategy.js#L26
  if (req.query['include-user-data']) data.user = ownerSafeData(req.user)
  res.json(data)
}
