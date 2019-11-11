// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const CONFIG = require('config')
const __ = require('config').universalPath
const _ = __.require('builders', 'utils')
const error_ = __.require('lib', 'error/error')
const responses_ = __.require('lib', 'responses')
const user_ = __.require('controllers', 'user/lib/user')
const promises_ = __.require('lib', 'promises')
const User = __.require('models', 'user')
const pw_ = __.require('lib', 'crypto').passwords
const { oneHour } =  __.require('lib', 'times')

module.exports = function(req, res, next){
  let test
  const { user, body } = req
  const { 'current-password':currentPassword, 'new-password':newPassword } = body
  const { resetPassword } = user

  if (!User.validations.password(newPassword)) {
    return error_.bundleInvalid(req, res, 'new-password', newPassword)
  }

  // classic password update
  if (currentPassword != null) {
    if (!User.validations.password(currentPassword)) {
      return error_.bundleInvalid(req, res, 'current-password', currentPassword)
    }
    test = verifyCurrentPassword(user, currentPassword).then(filterInvalid)

  // token-based password reset, with expiration date
  } else if (resetPassword != null) {
    if (!_.isNumber(resetPassword)) {
      return error_.bundle(req, res, 'invalid resetPassword timestamp', 500)
    }
    test = testOpenResetPasswordWindow(resetPassword)
  }

  if (test == null) {
    // it is a resetPassword request but without a valid reset
    return error_.bundle(req, res, 'reset password token expired: request a new token', 403)
  }

  return test
  .then(updatePassword.bind(null, user, newPassword))
  .then(responses_.Ok(res))
  .catch(error_.Handler(req, res))
}

var updatePassword = (user, newPassword) => pw_.hash(newPassword)
.then(updateUserPassword.bind(null, user._id, user))

var verifyCurrentPassword = (user, currentPassword) => pw_.verify(user.password, currentPassword)

var filterInvalid = function(isValid){
  if (!isValid) throw error_.newInvalid('new-password')
}

var updateUserPassword = (userId, user, newHash) => user_.db.update(userId, User.updatePassword.bind(null, user, newHash))

var testOpenResetPasswordWindow = function(resetPassword){
  if (_.expired(resetPassword, oneHour)) {
    return error_.reject('reset password timespan experied', 400)
  } else {
    return promises_.resolved
  }
}
