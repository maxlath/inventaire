import should from 'should'
import { addUserDocRole, createUserDoc, removeUserDocRole, softDeleteUser, updateUserDocEmail, updateUserItemsCounts } from '#models/user'
import { shouldNotBeCalled } from '#tests/unit/utils/utils'

const someUsername = 'rocky4'
const someEmail = 'hi@validemail.org'
const someLanguage = 'se'
const somePassword = 'password'

describe('user model', () => {
  describe('signup', () => {
    it('should return a user on valid args', async () => {
      const user = await createUserDoc(someUsername, someEmail, someLanguage, somePassword)
      user.should.be.an.Object()
      user.anonymizableId.should.be.a.String()
    })

    describe('username validation', () => {
      it('should throw on empty username', async () => {
        await createUserDoc('', someEmail, someLanguage, somePassword)
        .then(shouldNotBeCalled)
        .catch(err => {
          err.should.be.ok()
        })
      })

      it('should throw on username with space', async () => {
        await createUserDoc('with space', someEmail, someLanguage, somePassword)
        .then(shouldNotBeCalled)
        .catch(err => {
          err.should.be.ok()
        })
      })

      it('should throw on username with special characters', async () => {
        await createUserDoc('with$special%characters', someEmail, someLanguage, somePassword)
        .then(shouldNotBeCalled)
        .catch(err => {
          err.should.be.ok()
        })
      })

      it('should normalize usernames', async () => {
        const nfdNormalizedUsername = 'àéï'.normalize('NFD')
        const { username } = await createUserDoc(nfdNormalizedUsername, someEmail, someLanguage, somePassword)
        username.should.equal(nfdNormalizedUsername.normalize())
      })
    })

    describe('email validation', () => {
      it('should throw on invalid email', async () => {
        // @ts-expect-error
        await createUserDoc(someUsername, 'notanemail', someLanguage, somePassword)
        .then(shouldNotBeCalled)
        .catch(err => {
          err.should.be.ok()
        })
      })

      it('should throw on missing domain', async () => {
        await createUserDoc(someUsername, 'morelike@', someLanguage, somePassword)
        .then(shouldNotBeCalled)
        .catch(err => {
          err.should.be.ok()
        })
      })
    })

    describe('language validation', () => {
      it('should throw on invalid language', async () => {
        await createUserDoc(someUsername, someEmail, 'badlang', somePassword)
        .then(shouldNotBeCalled)
        .catch(err => {
          err.should.be.ok()
        })
      })

      it('should not throw on missing language', async () => {
        await createUserDoc(someUsername, someEmail, undefined, somePassword)
      })
    })

    describe('password validation', () => {
      it('should throw on passwords too short', async () => {
        await createUserDoc(someUsername, someEmail, someLanguage, 'shortpw')
        .then(shouldNotBeCalled)
        .catch(err => {
          err.should.be.ok()
        })
      })
    })
  })

  describe('delete', () => {
    it('should delete user attributes not needed by the user souvenir', async () => {
      const user = await createUserDoc(someUsername, someEmail, someLanguage, somePassword)
      // @ts-expect-error
      user._id = user._rev = 'foo'
      // @ts-ignore
      const userSouvenir = softDeleteUser(user)
      userSouvenir.deleted.should.be.a.Number()
      should(Date.now() - userSouvenir.deleted).be.below(2)
      delete userSouvenir.deleted
      userSouvenir.should.deepEqual({
        _id: user._id,
        _rev: user._rev,
        username: user.username,
        type: 'deleted',
        created: user.created,
      })
    })
  })

  describe('updateItemsCounts', () => {
    const counts = {
      private: { 'items:count': 1 },
      network: { 'items:count': 2 },
      public: { 'items:count': 3 },
    }

    it('should update items counts', async () => {
      const user = await createUserDoc(someUsername, someEmail, someLanguage, somePassword)
      const updatedUser = updateUserItemsCounts(counts)(user)
      should(updatedUser.snapshot).deepEqual(counts)
    })

    // This especially needs to be tested as it might happen that a debounced event
    // make updateItemsCounts be called after a user was deleted
    it('should not throw if the user was deleted', async () => {
      const user = await createUserDoc(someUsername, someEmail, someLanguage, somePassword)
      // @ts-ignore
      const userSouvenir = softDeleteUser(user)
      const updatedUser = updateUserItemsCounts(counts)(userSouvenir)
      should(updatedUser).equal(userSouvenir)
      should(updatedUser.snapshot).not.be.ok()
    })
  })

  describe('addUserDocRole', () => {
    it('should add a first role', async () => {
      const user = await createUserDoc(someUsername, someEmail, someLanguage, somePassword)
      should(user.roles).not.be.ok()
      addUserDocRole('admin')(user)
      user.roles.should.deepEqual([ 'admin' ])
    })

    it('should add a new role', async () => {
      const user = await createUserDoc(someUsername, someEmail, someLanguage, somePassword)
      addUserDocRole('admin')(user)
      addUserDocRole('dataadmin')(user)
      user.roles.should.deepEqual([ 'admin', 'dataadmin' ])
    })

    it('should not add a duplicated role', async () => {
      const user = await createUserDoc(someUsername, someEmail, someLanguage, somePassword)
      addUserDocRole('admin')(user);
      (() => addUserDocRole('admin')(user)).should.throw()
    })

    it('should reject an invalid role', async () => {
      const user = await createUserDoc(someUsername, someEmail, someLanguage, somePassword);
      (() => addUserDocRole('foo')(user)).should.throw()
    })
  })

  describe('removeUserDocRole', () => {
    it('should remove role', async () => {
      const user = await createUserDoc(someUsername, someEmail, someLanguage, somePassword)
      addUserDocRole('admin')(user)
      addUserDocRole('dataadmin')(user)
      removeUserDocRole('dataadmin')(user)
      user.roles.should.deepEqual([ 'admin' ])
    })

    it('should reject an invalid role', async () => {
      const user = await createUserDoc(someUsername, someEmail, someLanguage, somePassword);
      (() => addUserDocRole('foo')(user)).should.throw()
    })
  })

  describe('updateUserDocEmail', () => {
    it('should reset validEmail flag', async () => {
      const user = await createUserDoc(someUsername, someEmail, someLanguage, somePassword)
      user.validEmail = true
      const updatedEmail = updateUserDocEmail(user, 'foo@example.org')
      updatedEmail.validEmail.should.be.false()
    })
  })
})
