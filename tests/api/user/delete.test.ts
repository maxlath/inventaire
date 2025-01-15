import { map } from 'lodash-es'
import should from 'should'
import { createGroup, addMember, addAdmin, addInvited, addRequested, addDeclined } from '#fixtures/groups'
import { createItem } from '#fixtures/items'
import { createElement, createListing } from '#fixtures/listings'
import { createShelf } from '#fixtures/shelves'
import { createTransaction } from '#fixtures/transactions'
import { getRefreshedUser, getRandomPosition, createUser } from '#fixtures/users'
import { federatedMode } from '#server/config'
import { getGroup } from '#tests/api/utils/groups'
import { getItem } from '#tests/api/utils/items'
import { getListingById } from '#tests/api/utils/listings'
import { waitForIndexation, waitForDeindexation } from '#tests/api/utils/search'
import { getShelfById } from '#tests/api/utils/shelves'
import { getTransaction, updateTransaction } from '#tests/api/utils/transactions'
import { getUsersNearPosition, deleteUser } from '#tests/api/utils/users'
import { getUser } from '#tests/api/utils/utils'
import { shouldNotBeCalled, rethrowShouldNotBeCalledErrors } from '#tests/unit/utils/utils'

describe('user:delete', () => {
  it('should delete the user', async () => {
    const user = await createUser()
    const res = await deleteUser(user)
    res.ok.should.be.true()
    const deletedUser = await getRefreshedUser(user)
    deletedUser._id.should.equal(user._id)
    const previousRevInteger = parseInt(user._rev.split('-')[0])
    parseInt(deletedUser._rev.split('-')[0]).should.equal(previousRevInteger + 1)
    deletedUser.username.should.equal(user.username)
    should(deletedUser.password).not.be.ok()
    should(deletedUser.email).not.be.ok()
    should(deletedUser.settings).not.be.ok()
    should(deletedUser.readToken).not.be.ok()
    should(deletedUser.picture).not.be.ok()
    should(deletedUser.snapshot).not.be.ok()
  })

  it('should remove the user from the geo index', async () => {
    const position = getRandomPosition()
    const user = await createUser({ position })
    await waitForIndexation('users', user._id)
    const users = await getUsersNearPosition(position)
    map(users, '_id').should.containEql(user._id)
    await deleteUser(user)
    await waitForDeindexation('users', user._id)
    const refreshedUsers = await getUsersNearPosition(position)
    map(refreshedUsers, '_id').should.not.containEql(user._id)
  })

  describe('items', () => {
    it('should delete the user items', async () => {
      const user = await createUser()
      const item = await createItem(user, { visibility: [ 'public' ] })
      const deleteRes = await deleteUser(user)
      deleteRes.ok.should.be.true()
      const updatedItem = await getItem(item)
      should(updatedItem).not.be.ok()
    })
  })

  describe('shelves', () => {
    it('should delete the user shelves', async () => {
      const user = await createUser()
      const { shelf } = await createShelf(user, { visibility: [ 'public' ] })
      const deleteRes = await deleteUser(user)
      deleteRes.ok.should.be.true()
      await getShelfById(getUser(), shelf._id)
      .then(shouldNotBeCalled)
      .catch(err => {
        err.statusCode.should.equal(404)
      })
    })
  })

  describe('groups', () => {
    it('should remove the user when member', async () => {
      const [ user, group ] = await Promise.all([ createUser(), createGroup() ])
      const [ refreshedGroup ] = await addMember(group, user)
      map(refreshedGroup.members, 'user').should.containEql(user._id)
      await deleteUser(user)
      const rerefreshedGroup = await getGroup(group)
      map(rerefreshedGroup.members, 'user').should.not.containEql(user._id)
    })

    it('should remove the user when admin, but not delete the group', async () => {
      const [ user, group ] = await Promise.all([ createUser(), createGroup() ])
      const [ refreshedGroup ] = await addAdmin(group, user)
      map(refreshedGroup.admins, 'user').should.containEql(user._id)
      await deleteUser(user)
      const rerefreshedGroup = await getGroup(group)
      map(rerefreshedGroup.admins, 'user').should.not.containEql(user._id)
    })

    it('should delete the group when the user was the last member', async function () {
      if (federatedMode) this.skip()
      const user = await createUser()
      const group = await createGroup({ user })
      map(group.admins, 'user').should.containEql(user._id)
      await deleteUser(user)
      try {
        await getGroup(group).then(shouldNotBeCalled)
      } catch (err) {
        rethrowShouldNotBeCalledErrors(err)
        err.statusCode.should.equal(404)
      }
    })

    it('should remove the user when "invited"', async () => {
      const [ user, group ] = await Promise.all([ createUser(), createGroup() ])
      const [ refreshedGroup ] = await addInvited(group, user)
      map(refreshedGroup.invited, 'user').should.containEql(user._id)
      await deleteUser(user)
      const rerefreshedGroup = await getGroup(group)
      map(rerefreshedGroup.invited, 'user').should.not.containEql(user._id)
    })

    it('should remove the user when "requested"', async () => {
      const [ user, group ] = await Promise.all([ createUser(), createGroup() ])
      const [ refreshedGroup ] = await addRequested(group, user)
      map(refreshedGroup.requested, 'user').should.containEql(user._id)
      await deleteUser(user)
      const rerefreshedGroup = await getGroup(group)
      map(rerefreshedGroup.requested, 'user').should.not.containEql(user._id)
    })

    it('should remove the user when "declined"', async () => {
      const [ user, group ] = await Promise.all([ createUser(), createGroup() ])
      const [ refreshedGroup ] = await addDeclined(group, user)
      map(refreshedGroup.declined, 'user').should.containEql(user._id)
      await deleteUser(user)
      const rerefreshedGroup = await getGroup(group)
      map(rerefreshedGroup.declined, 'user').should.not.containEql(user._id)
    })
  })

  describe('transactions', () => {
    it('should cancel active transactions', async () => {
      const user = await createUser()
      const { transaction } = await createTransaction({ requester: user, owner: getUser() })
      transaction.state.should.equal('requested')
      await deleteUser(user)
      const updatedTransaction = await getTransaction(user, transaction._id)
      updatedTransaction.state.should.equal('cancelled')
    })

    it('should not affect already terminated transactions', async () => {
      const user = await createUser()
      const { transaction } = await createTransaction({ requester: user, owner: getUser() })
      transaction.state.should.equal('requested')
      await updateTransaction(getUser(), transaction._id, 'declined')
      const updatedTransaction = await getTransaction(user, transaction._id)
      updatedTransaction.state.should.equal('declined')
      await deleteUser(user)
      const reupdatedTransaction = await getTransaction(user, transaction._id)
      reupdatedTransaction.state.should.equal('declined')
      reupdatedTransaction._rev.should.equal(updatedTransaction._rev)
    })
  })

  describe('listings', () => {
    it('should delete listings', async () => {
      const user = await createUser()
      const { listing } = await createListing(user, { visibility: [ 'public' ] })
      // TODO: check that the element was also deleted
      // Requires an endpoint to get elements directly?
      await createElement({ listing }, user)
      await deleteUser(user)
      await getListingById({ id: listing._id })
      .then(shouldNotBeCalled)
      .catch(err => {
        err.statusCode.should.equal(404)
      })
    })
  })
})
