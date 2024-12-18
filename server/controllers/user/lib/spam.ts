import { handleAbuseReport } from '#controllers/user/lib/abuse_reports'
import { isNonEmptyString } from '#lib/boolean_validations'
import type { BareRemoteUser } from '#lib/federation/remote_user'
import config from '#server/config'
import type { SpamReport, User } from '#types/user'

const { suspectKeywords } = config.spam
const suspectKeywordsPattern = new RegExp(`(${suspectKeywords.join('|')})`, 'i')
const urlPattern = /(http|www\.|\w+\.\w+\/)/i

function looksLikeSpam (text: string) {
  return suspectKeywordsPattern.test(text) && urlPattern.test(text)
}

export async function checkSpamContent (reqUser: User | BareRemoteUser, ...values: unknown[]) {
  for (const value of values) {
    if (isNonEmptyString(value)) {
      if (looksLikeSpam(value)) {
        const report: SpamReport = { type: 'spam', text: value, timestamp: Date.now() }
        // TODO: find a way to report abuse to the remote instance
        if ('_id' in reqUser) await handleAbuseReport(reqUser, report)
      }
    }
  }
}
