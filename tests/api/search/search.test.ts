import 'should'
import { map } from 'lodash-es'
import { getSomeGroupWithAMember, createGroupAndMember, createGroup, createGroupWithAMember } from '#fixtures/groups'
import { createListing } from '#fixtures/listings'
import { createShelf } from '#fixtures/shelves'
import { createUser } from '#fixtures/users'
import { getGroupVisibilityKey } from '#lib/visibility/visibility'
import { federatedMode } from '#server/config'
import { makeFriends } from '#tests/api/utils/relations'
import { search, waitForIndexation, firstNWords, customAuthSearch } from '#tests/api/utils/search'
import { publicReq, getUser, getUserB } from '#tests/api/utils/utils'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'

describe('search:global', () => {
  describe('parameters', () => {
    it('should reject empty searches', async () => {
      try {
        await publicReq('get', '/api/search?lang=en&types=works').then(shouldNotBeCalled)
      } catch (err) {
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.equal('missing parameter in query: search or claim')
      }
    })

    it('should not crashed when the search contains special characters', async () => {
      const query = encodeURIComponent("L'eau d\\o~uc/e/-e[n] ~pé*ril!~*")
      const { results } = await publicReq('get', `/api/search?lang=en&types=works&search=${query}`)
      results.should.be.an.Array()
    })
  })

  describe('types', () => {
    it('should reject search without types', async () => {
      try {
        await publicReq('get', '/api/search?search=yo&lang=en').then(shouldNotBeCalled)
      } catch (err) {
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.equal('missing parameter in query: types')
      }
    })

    it('should reject invalid types', async function () {
      if (federatedMode) this.skip()
      try {
        await search('da', 'yo').then(shouldNotBeCalled)
      } catch (err) {
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.startWith('invalid types: da')
      }
    })

    it('should reject queries mixing social and entities types', async () => {
      try {
        await search([ 'users', 'humans' ], 'foo').then(shouldNotBeCalled)
      } catch (err) {
        err.statusCode.should.equal(400)
        err.body.status_verbose.should.startWith('can not have both social and entity types')
      }
    })
  })

  describe('user', () => {
    it('should return a user', async () => {
      const user = await getUser()
      await waitForIndexation('users', user._id)
      const results = await search('users', user.username)
      results.should.be.an.Array()
      map(results, 'id').should.containEql(user._id)
    })

    it('should only return users', async () => {
      const group = await createGroup()
      await waitForIndexation('groups', group._id)
      const results = await search('users', group.name)
      results.should.be.an.Array()
      results.forEach(result => result.type.should.equal('users'))
    })
  })

  describe('group', () => {
    it('should return a group', async () => {
      const group = await createGroup()
      await waitForIndexation('groups', group._id)
      const results = await search('groups', group.name)
      results.should.be.an.Array()
      results.forEach(result => result.type.should.equal('groups'))
      map(results, 'id').should.containEql(group._id)
    })

    it('should not return a private group unless requester is a member', async () => {
      const group = await createGroup({ searchable: false })
      await waitForIndexation('groups', group._id)
      const results = await search('groups', group.name)
      map(results, 'id').should.not.containEql(group._id)
      // The same request but authentified with a group member account should find the group
      const refreshedResults = await customAuthSearch(getUser(), 'groups', group.name)
      map(refreshedResults, 'id').should.containEql(group._id)
    })
  })

  describe('shelf', () => {
    it('should find a shelf with words from the name', async () => {
      const { shelf } = await createShelf()
      await waitForIndexation('shelves', shelf._id)
      const results = await search('shelves', firstNWords(shelf.name, 2))
      results.should.be.an.Array()
      map(results, 'id').should.containEql(shelf._id)
    })

    it('should find a shelf with words from the description', async () => {
      const { shelf } = await createShelf()
      await waitForIndexation('shelves', shelf._id)
      const results = await search('shelves', firstNWords(shelf.description, 2))
      results.should.be.an.Array()
      map(results, 'id').should.containEql(shelf._id)
    })

    describe('public request', () => {
      it('should not return a private shelf', async () => {
        const { shelf } = await createShelf(getUser(), { visibility: [] })
        await waitForIndexation('shelves', shelf._id)
        const results = await search('shelves', firstNWords(shelf.name, 2))
        results.should.be.an.Array()
        map(results, 'id').should.not.containEql(shelf._id)
      })
    })

    describe('authentified request', () => {
      it('should return a private shelf from the requesting user', async () => {
        const { shelf } = await createShelf(getUser(), { visibility: [] })
        await waitForIndexation('shelves', shelf._id)
        const results = await customAuthSearch(getUser(), 'shelves', firstNWords(shelf.name, 2))
        results.should.be.an.Array()
        map(results, 'id').should.containEql(shelf._id)
      })

      it('should not return a private shelf from another user', async () => {
        const { shelf } = await createShelf(getUser(), { visibility: [] })
        await waitForIndexation('shelves', shelf._id)
        const results = await customAuthSearch(getUserB(), 'shelves', firstNWords(shelf.name, 2))
        results.should.be.an.Array()
        map(results, 'id').should.not.containEql(shelf._id)
      })

      it('should return a group-specific shelf when requested by a member', async () => {
        const { group, admin, member } = await createGroupWithAMember()
        const { shelf } = await createShelf(admin, { visibility: [ getGroupVisibilityKey(group._id) ] })
        await waitForIndexation('shelves', shelf._id)
        const results = await customAuthSearch(member, 'shelves', firstNWords(shelf.name, 2))
        results.should.be.an.Array()
        map(results, 'id').should.containEql(shelf._id)
      })

      it('should return a group-specific shelf when requested by a member', async () => {
        const { group, admin } = await createGroupWithAMember()
        const someOtherUser = await createUser()
        const { shelf } = await createShelf(admin, { visibility: [ getGroupVisibilityKey(group._id) ] })
        await waitForIndexation('shelves', shelf._id)
        const results = await customAuthSearch(someOtherUser, 'shelves', firstNWords(shelf.name, 2))
        results.should.be.an.Array()
        map(results, 'id').should.not.containEql(shelf._id)
      })
    })
  })

  describe('listing', () => {
    it('should find a listing with words from the name', async () => {
      const { listing } = await createListing()
      await waitForIndexation('lists', listing._id)
      const results = await search('lists', firstNWords(listing.name, 2))
      results.should.be.an.Array()
      map(results, 'id').should.containEql(listing._id)
    })

    it('should find a listing with words from the description', async () => {
      const { listing } = await createListing()
      await waitForIndexation('lists', listing._id)
      const results = await search('lists', firstNWords(listing.description, 2))
      results.should.be.an.Array()
      map(results, 'id').should.containEql(listing._id)
    })

    describe('public request', () => {
      it('should not return a private listing', async () => {
        const { listing } = await createListing(getUser(), { visibility: [] })
        await waitForIndexation('lists', listing._id)
        const results = await search('lists', firstNWords(listing.name, 2))
        results.should.be.an.Array()
        map(results, 'id').should.not.containEql(listing._id)
      })
    })

    describe('authentified request', () => {
      it('should return a private listing from the requesting user', async () => {
        const { listing } = await createListing(getUser(), { visibility: [] })
        await waitForIndexation('lists', listing._id)
        const results = await customAuthSearch(getUser(), 'lists', firstNWords(listing.name, 2))
        results.should.be.an.Array()
        map(results, 'id').should.containEql(listing._id)
      })

      it('should not return a private listing from another user', async () => {
        const { listing } = await createListing(getUser(), { visibility: [] })
        await waitForIndexation('lists', listing._id)
        const results = await customAuthSearch(getUserB(), 'lists', firstNWords(listing.name, 2))
        results.should.be.an.Array()
        map(results, 'id').should.not.containEql(listing._id)
      })

      it('should return a group-specific listing when requested by a member', async () => {
        const { group, admin, member } = await createGroupWithAMember()
        const { listing } = await createListing(admin, { visibility: [ getGroupVisibilityKey(group._id) ] })
        await waitForIndexation('lists', listing._id)
        const results = await customAuthSearch(member, 'lists', firstNWords(listing.name, 2))
        results.should.be.an.Array()
        map(results, 'id').should.containEql(listing._id)
      })

      it('should not return a group-specific listing when requested by a non member', async () => {
        const { group, admin } = await createGroupWithAMember()
        const someOtherUser = await createUser()
        const { listing } = await createListing(admin, { visibility: [ getGroupVisibilityKey(group._id) ] })
        await waitForIndexation('lists', listing._id)
        const results = await customAuthSearch(someOtherUser, 'lists', firstNWords(listing.name, 2))
        results.should.be.an.Array()
        map(results, 'id').should.not.containEql(listing._id)
      })

      it('should not find listings visible by groups while the users are friends but not in a common group', async () => {
        const { member } = await getSomeGroupWithAMember()
        const { member: memberOfAnotherGroup } = await createGroupAndMember()
        await makeFriends(member, memberOfAnotherGroup)
        const { listing } = await createListing(member, { visibility: [ 'groups' ] })
        await waitForIndexation('lists', listing._id)
        const results = await customAuthSearch(memberOfAnotherGroup, 'lists', firstNWords(listing.name, 2))
        results.should.be.an.Array()
        map(results, 'id').should.not.containEql(listing._id)
      })
    })
  })
})
