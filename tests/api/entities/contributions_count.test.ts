import { oneDay } from '#lib/time'
import { simpleDay } from '#lib/utils/base'
import { federatedMode } from '#server/config'
import { adminReq } from '#tests/api/utils/utils'

const endpoint = '/api/entities?action=contributions-count'

describe('entities:activity', () => {
  it('should return global contributions count', async function () {
    if (federatedMode) this.skip()
    const { contributions } = await adminReq('get', endpoint)
    contributions.forEach(contribution => {
      contribution.user.should.be.a.String()
      contribution.contributions.should.be.a.Number()
    })
  })

  it('should return contributions count for a specific period', async function () {
    if (federatedMode) this.skip()
    const { contributions, start, end } = await adminReq('get', `${endpoint}&period=7`)
    contributions.should.be.an.Array()
    contributions.forEach(contribution => {
      contribution.user.should.be.a.String()
      contribution.contributions.should.be.a.Number()
    })
    start.should.equal(simpleDay(Date.now() - 7 * oneDay))
    end.should.equal(simpleDay(Date.now()))
  })

  it('should restrict activity to the specfied period', async function () {
    if (federatedMode) this.skip()
    const { contributions, start, end } = await adminReq('get', `${endpoint}&period=1`)
    const yesterdayTime = Date.now() - (24 * 60 * 60 * 1000)
    const yesterday = simpleDay(yesterdayTime)
    const today = simpleDay()
    contributions.should.be.an.Array()
    start.should.equal(yesterday)
    end.should.equal(today)
  })
})
