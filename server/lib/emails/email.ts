import type { TransactionEmailViewModel } from '#lib/emails/build_transaction_email'
import { kmBetween } from '#lib/geo'
import { assertObjects } from '#lib/utils/assert_types'
import { shortLang } from '#lib/utils/base'
import { warn } from '#lib/utils/logs'
import { buildUrl } from '#lib/utils/url'
import { defaultFrom, publicOrigin } from '#server/config'
import type { AbsoluteUrl } from '#types/common'
import type { TransactionUserRole } from '#types/transaction'
import checkUserNotificationsSettings from './check_user_notifications_settings.js'
import { i18n } from './i18n/i18n.js'

const origin = publicOrigin

export default {
  validationEmail: (user, token) => {
    // purposedly not checking notifications settings
    const { email, language } = user
    const lang = shortLang(language)
    const href = buildTokenUrl('validation-email', email, token)

    return {
      to: email,
      subject: i18n(lang, 'email_confirmation_subject'),
      template: 'validation_email',
      context: { lang, user, href },
    }
  },

  mailerTest: destinationEmail => {
    const message = 'This email is a test email'
    return {
      to: destinationEmail,
      subject: 'Test email',
      template: 'mailer_test',
      context: { message, origin },
    }
  },

  resetPassword: (user, token) => {
    // purposedly not checking notifications settings
    const { email, language } = user
    const lang = shortLang(language)
    const href = buildTokenUrl('reset-password', email, token)

    return {
      to: email,
      subject: i18n(lang, 'reset_password_subject'),
      template: 'reset_password',
      context: { lang, user, href },
    }
  },

  friendAcceptedRequest: options => {
    const [ user1, user2 ] = validateOptions(options)
    const lang = shortLang(user1.language)

    checkUserNotificationsSettings(user1, 'friend_accepted_request')

    return {
      to: user1.email,
      subject: i18n(lang, 'friend_accepted_request_subject', user2),
      template: 'friend_accepted_request',
      context: { user: user1, friend: user2, lang, origin },
    }
  },

  friendshipRequest: options => {
    const [ user1, user2 ] = Array.from(validateOptions(options))
    const lang = shortLang(user1.language)

    checkUserNotificationsSettings(user1, 'friendship_request')

    user2.href = `${origin}/users/${user2.username}`

    let { bio } = user2
    if (bio == null) bio = ''
    if (bio.length > 200) bio = `${bio.slice(0, 200)}...`
    user2.bio = bio

    if ((user1.position != null) && (user2.position != null)) {
      user2.distance = kmBetween(user1.position, user2.position)
    }

    return {
      to: user1.email,
      subject: i18n(lang, 'friendship_request_subject', user2),
      template: 'friendship_request',
      context: { user: user1, otherUser: user2, lang, origin },
    }
  },

  group: (action, context) => {
    const { group, actingUser, userToNotify } = context
    const { language, email } = userToNotify
    const lang = shortLang(language)

    checkUserNotificationsSettings(userToNotify, `group_${action}`)

    const groupContext = {
      groupName: group.name,
      actingUserUsername: actingUser.username,
    }

    const title = `group_${action}_subject`
    const button = `group_${action}_button`

    return {
      to: email,
      subject: i18n(lang, `group_${action}_subject`, groupContext),
      template: 'group',
      context: { title, button, group, groupContext, lang, origin },
    }
  },

  GroupJoinRequest: (requester, group) => {
    const emailKey = 'group_join_request'
    const groupName = group.name
    const requesterUsername = requester.username
    return userToNotify => {
      const { _id: userId, email, lang } = userToNotify
      try {
        checkUserNotificationsSettings(userToNotify, emailKey)
      } catch (err) {
        if (err.type === 'email_disabled') {
          warn(`user ${userId} disabled ${emailKey} notifications: skip`)
          return
        } else {
          throw err
        }
      }
      const subject = i18n(lang, `${emailKey}_subject`, { groupName, requesterUsername })
      return {
        to: email,
        subject,
        template: emailKey,
        context: {
          title: subject,
          button: `${emailKey}_button`,
          buttonContext: { groupName, requesterUsername },
          requester,
          group,
          lang,
          origin,
        },
      }
    }
  },

  feedback: (subject, message, user, unknownUser, uris, context) => {
    // No email settings to check here
    const username = (user && user.username) || 'anonymous'
    return {
      to: defaultFrom,
      replyTo: user && user.email,
      subject: `[feedback][${username}] ${subject}`,
      template: 'feedback',
      context: { subject, message, user, unknownUser, uris, origin, context },
    }
  },

  FriendInvitation: (inviter, message) => {
    // No email settings to check here:
    // - Existing users aren't sent an email invitation but get a friend request
    //   where their notifications settings will be applied
    // - Invited users who don't want more emails should have been filtered-out
    //   by invitations/lib/send_invitations extractCanBeInvited
    const { username, language } = inviter
    const lang = shortLang(language)

    inviter.pathname = `${origin}/users/${username}`
    return emailAddress => {
      return {
        to: emailAddress,
        subject: i18n(lang, 'email_invitation_subject', inviter),
        template: 'email_invitation',
        context: { inviter, message, lang, origin },
      }
    }
  },

  GroupInvitation: (inviter, group, message) => {
    // No email settings to check here neither (idem FriendInvitation)
    const { username, language } = inviter
    const lang = shortLang(language)
    const { name: groupName, slug } = group
    const pathname = `${origin}/groups/${slug}`
    // Object required to pass as i18n strings context
    return emailAddress => ({
      to: emailAddress,
      subject: i18n(lang, 'group_email_invitation_subject', { username, groupName }),
      template: 'group_email_invitation',
      context: { message, lang, origin, username, groupName, pathname },
    })
  },

  transactions: {
    yourItemWasRequested: (transactionEmailViewModel: TransactionEmailViewModel) => {
      return transactionEmail(transactionEmailViewModel, 'owner', 'your_item_was_requested')
    },

    updateOnYourItem: (transactionEmailViewModel: TransactionEmailViewModel) => {
      return transactionEmail(transactionEmailViewModel, 'owner', 'update_on_your_item')
    },

    updateOnItemYouRequested: (transactionEmailViewModel: TransactionEmailViewModel) => {
      return transactionEmail(transactionEmailViewModel, 'requester', 'update_on_item_you_requested')
    },
  },
}

function transactionEmail (transactionEmailViewModel: TransactionEmailViewModel, role: TransactionUserRole, label: string) {
  const { transaction, mainUser, other, itemTitle } = transactionEmailViewModel
  checkUserNotificationsSettings(mainUser, label)
  const otherRole = role === 'owner' ? 'requester' : 'owner'
  const lang = shortLang(mainUser.language)

  const titleContext = {
    username: transactionEmailViewModel[otherRole].username,
    title: itemTitle,
  }
  return {
    to: transactionEmailViewModel[role].email,
    subject: i18n(lang, `${label}_title`, titleContext),
    template: 'transaction_update',
    context: Object.assign(transactionEmailViewModel, {
      origin: publicOrigin,
      link: `${publicOrigin}/transactions/${transaction._id}`,
      title: itemTitle,
      username: other.username,
      subject: `${label}_subject`,
      button: `${label}_button`,
      lang,
    }),

  }
}

function validateOptions (options) {
  const { user1, user2 } = options
  assertObjects([ user1, user2 ])
  if (user1.email == null) throw new Error('missing user1 email')
  if (user2.username == null) throw new Error('missing user2 username')
  return [ user1, user2 ]
}

function buildTokenUrl (action, email, token) {
  const pathname: AbsoluteUrl = `${publicOrigin}/api/token`
  return buildUrl(pathname, { action, email, token })
}
