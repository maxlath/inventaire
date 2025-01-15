import should from 'should'
import { getFirstClaimValue } from '#controllers/entities/lib/inv_claims_utils'
import { createEdition, createWork } from '#fixtures/entities'
import { createGroup } from '#fixtures/groups'
import { createItem } from '#fixtures/items'
import { createElement, createListing, updateElement, updateListing } from '#fixtures/listings'
import { createShelf } from '#fixtures/shelves'
import { createUser, someSpamText, type UserWithCookie } from '#fixtures/users'
import { buildUrl } from '#lib/utils/url'
import { federatedMode } from '#server/config'
import { updateClaim, updateLabel } from '#tests/api/utils/entities'
import { updateGroup } from '#tests/api/utils/groups'
import { updateItem, updateItems } from '#tests/api/utils/items'
import { updateShelf } from '#tests/api/utils/shelves'
import { catchSpamRejection, updateUser } from '#tests/api/utils/users'
import { adminReq, authReq } from '#tests/api/utils/utils'

describe('user:abuse reports', () => {
  describe('spam', () => {
    it('should report user bio spam', async () => {
      const spammyUser = await createUser()
      await updateUser({ user: spammyUser, attribute: 'bio', value: someSpamText })
      await userShouldHaveASpamAbuseReport(spammyUser)
    })

    it('should report item details spam during creation', async () => {
      const spammyUser = await createUser()
      await createItem(spammyUser, { details: someSpamText })
      await userShouldHaveASpamAbuseReport(spammyUser)
    })

    it('should report item details spam during update', async () => {
      const spammyUser = await createUser()
      const item = await createItem(spammyUser)
      item.details = someSpamText
      await updateItem(item, spammyUser)
      await userShouldHaveASpamAbuseReport(spammyUser)
    })

    it('should report item details spam during bulk update', async () => {
      const spammyUser = await createUser()
      const item = await createItem(spammyUser)
      await updateItems({ ids: item._id, attribute: 'details', value: someSpamText, user: spammyUser })
      await userShouldHaveASpamAbuseReport(spammyUser)
    })

    it('should report shelf description spam during creation', async () => {
      const spammyUser = await createUser()
      await createShelf(spammyUser, { description: someSpamText })
      await userShouldHaveASpamAbuseReport(spammyUser)
    })

    it('should report shelf description spam during update', async () => {
      const spammyUser = await createUser()
      const { shelf } = await createShelf(spammyUser)
      await updateShelf({ id: shelf._id, attribute: 'description', value: someSpamText, user: spammyUser })
      await userShouldHaveASpamAbuseReport(spammyUser)
    })

    it('should report listing description spam during creation', async () => {
      const spammyUser = await createUser()
      await createListing(spammyUser, { description: someSpamText })
      await userShouldHaveASpamAbuseReport(spammyUser)
    })

    it('should report listing description spam during update', async () => {
      const spammyUser = await createUser()
      const { listing } = await createListing(spammyUser)
      listing.description = someSpamText
      await updateListing(spammyUser, listing)
      await userShouldHaveASpamAbuseReport(spammyUser)
    })

    it('should report listing element comment spam during update', async () => {
      const spammyUser = await createUser()
      const { element } = await createElement({}, spammyUser)
      element.comment = someSpamText
      await updateElement(element, spammyUser)
      await userShouldHaveASpamAbuseReport(spammyUser)
    })

    it('should report group name spam during creation', async () => {
      const spammyUser = await createUser()
      await createGroup({ name: someSpamText, user: spammyUser })
      await userShouldHaveASpamAbuseReport(spammyUser)
    })

    it('should report group name spam during update', async () => {
      const spammyUser = await createUser()
      const group = await createGroup({ user: spammyUser })
      await updateGroup({ group, user: spammyUser, attribute: 'name', value: someSpamText })
      await userShouldHaveASpamAbuseReport(spammyUser)
    })

    it('should report group description spam during creation', async () => {
      const spammyUser = await createUser()
      await createGroup({ description: someSpamText, user: spammyUser })
      await userShouldHaveASpamAbuseReport(spammyUser)
    })

    it('should report group description spam during update', async () => {
      const spammyUser = await createUser()
      const group = await createGroup({ user: spammyUser })
      await updateGroup({ group, user: spammyUser, attribute: 'description', value: someSpamText })
      await userShouldHaveASpamAbuseReport(spammyUser)
    })

    it('should report entity label spam', async () => {
      const spammyUser = await createUser()
      const { uri } = await createWork()
      await updateLabel({ uri, lang: 'en', value: someSpamText, user: spammyUser })
      await userShouldHaveASpamAbuseReport(spammyUser)
    })

    it('should report entity claim value spam', async () => {
      const spammyUser = await createUser()
      const { uri, claims } = await createEdition()
      const title = getFirstClaimValue(claims, 'wdt:P1476')
      await updateClaim({ uri, property: 'wdt:P1476', oldValue: title, newValue: someSpamText, user: spammyUser })
      await userShouldHaveASpamAbuseReport(spammyUser)
    })
  })

  describe('reports access', () => {
    it('should let admin users access the abuse reports', async function () {
      // Disabled in federated mode yet as this test relies on a special role
      if (federatedMode) this.skip()
      const user = await createUser()
      await updateUser({ user, attribute: 'bio', value: someSpamText }).catch(catchSpamRejection)
      await userShouldHaveASpamAbuseReport(user)
    })

    it('should not let non-admin users get the abuse report', async () => {
      const user = await createUser()
      await updateUser({ user, attribute: 'bio', value: someSpamText }).catch(catchSpamRejection)
      const { users: nonAdminViewUsers } = await authReq('get', buildUrl('/api/users', { action: 'by-ids', ids: user._id }))
      const nonAdminViewUser = nonAdminViewUsers[user._id]
      should(nonAdminViewUser.reports).not.be.ok()
    })
  })
})

async function userShouldHaveASpamAbuseReport (user: UserWithCookie) {
  const { users: adminViewUsers } = await adminReq('get', buildUrl('/api/users', { action: 'by-ids', ids: user._id }))
  const adminViewUser = adminViewUsers[user._id]
  const { reports } = adminViewUser
  reports.length.should.equal(1)
  reports[0].type.should.equal('spam')
  reports[0].timestamp.should.be.a.Number()
}
