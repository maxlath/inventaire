import { compact, map } from 'lodash-es'
import { getGroupById } from '#controllers/groups/lib/groups'
import { getUserById, getUsersByIds, serializeUserData } from '#controllers/user/lib/user'
import { catchDisabledEmails, getGroupAndUsersData, getParsedUsersIndexedByIds } from '#lib/emails/helpers'
import { sendMail } from '#lib/emails/transporter'
import { wait } from '#lib/promises'
import { info, logError, LogError } from '#lib/utils/logs'
import email_ from './email.js'

export default {
  validationEmail: (userData, token) => {
    userData = serializeUserData(userData)
    const email = email_.validationEmail(userData, token)
    return sendMail(email)
    .catch(LogError('validationEmail'))
  },

  mailerTest: destinationEmail => {
    const email = email_.mailerTest(destinationEmail)
    return sendMail(email)
  },

  resetPassword: (userData, token) => {
    userData = serializeUserData(userData)
    const email = email_.resetPassword(userData, token)
    return sendMail(email)
    .catch(LogError('resetPassword'))
  },

  friendAcceptedRequest: (userToNotify, newFriend) => {
    return getParsedUsersIndexedByIds(userToNotify, newFriend)
    .then(email_.friendAcceptedRequest)
    .then(sendMail)
    .catch(catchDisabledEmails)
    .catch(Err('friendAcceptedRequest', userToNotify, newFriend))
  },

  friendshipRequest: (userToNotify, requestingUser) => {
    return getParsedUsersIndexedByIds(userToNotify, requestingUser)
    .then(email_.friendshipRequest)
    .then(sendMail)
    .catch(catchDisabledEmails)
    .catch(Err('friendshipRequest', userToNotify, requestingUser))
  },

  group: (action, groupId, actingUserId, userToNotifyId) => {
    return getGroupAndUsersData(groupId, actingUserId, userToNotifyId)
    .then(email_.group.bind(null, action))
    .then(sendMail)
    .catch(catchDisabledEmails)
    .catch(Err(`group ${action}`, actingUserId, userToNotifyId))
  },

  groupJoinRequest: async (groupId, requestingUserId) => {
    const group = await getGroupById(groupId)
    if (group.open) return
    const adminsIds = map(group.admins, 'user')
    const admins = await getUsersByIds(adminsIds)
    const userData = await getUserById(requestingUserId)
    let emails = admins.map(email_.GroupJoinRequest(userData, group))
    // Remove emails aborted due to user settings
    emails = compact(emails)
    return sendSequentially(emails, 'groupJoinRequest')
  },

  feedback: (subject, message, user, unknownUser, uris, context) => {
    const email = email_.feedback(subject, message, user, unknownUser, uris, context)
    return sendMail(email)
    .catch(LogError('feedback'))
  },

  friendInvitations: (userData, emailAddresses, message) => {
    userData = serializeUserData(userData)
    const emails = emailAddresses.map(email_.FriendInvitation(userData, message))
    return sendSequentially(emails, 'friendInvitations')
  },

  groupInvitations: (userData, group, emailAddresses, message) => {
    userData = serializeUserData(userData)
    const emails = emailAddresses.map(email_.GroupInvitation(userData, group, message))
    return sendSequentially(emails, 'groupInvitations')
  },
}

async function sendSequentially (emails, label) {
  const totalEmails = emails.length

  async function sendNext () {
    const nextEmail = emails.pop()
    if (!nextEmail) return
    info(`[${label} email] sending ${totalEmails - emails.length}/${totalEmails}`)
    try {
      await sendMail(nextEmail)
    } catch (err) {
      logError(err, `${label} (address: ${nextEmail.to} err)`)
    }
    // Wait to lower risk to trigger any API quota issue from the email service
    await wait(500)
    // In any case, send the next
    return sendNext()
  }

  return sendNext()
}

const Err = (label, user1, user2) => LogError(`${label} email fail for ${user1} / ${user2}`)
