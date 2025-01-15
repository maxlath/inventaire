import 'should'
import { wait } from '#lib/promises'
import { emit, radio } from '#lib/radio'
import config from '#server/config'

// Do not run without having set NODE_ENV
config.env.should.containEql('tests')

describe('radio', () => {
  describe('emit [in test environment]', () => {
    it('should return a promise', async () => {
      let waited = false
      radio.on('foo', async () => {
        await wait(100)
        waited = true
      })
      const promise = emit('foo')
      promise.should.be.a.Promise()
      await promise
      waited.should.be.true()
    })

    it('should return a resolved promise, even in case of a falling promise', async () => {
      let waited = false
      radio.on('foo', async () => {
        await wait(100)
        waited = true
      })
      radio.on('foo', async () => { throw new Error('nop') })
      const promise = emit('foo')
      promise.should.be.a.Promise()
      await promise
      waited.should.be.true()
    })
  })
})
