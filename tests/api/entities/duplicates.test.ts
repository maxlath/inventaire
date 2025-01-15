import { createHuman } from '#fixtures/entities'
import { humanName } from '#fixtures/text'
import { wait } from '#lib/promises'
import { federatedMode } from '#server/config'
import { adminReq } from '#tests/api/utils/utils'

const endpoint = '/api/entities?action=duplicates'

describe('entities:duplicates', () => {
  it('should return names and duplicates number', async function () {
    if (federatedMode) this.skip()
    const someName = humanName()
    await Promise.all([
      createHuman({ labels: { en: someName } }),
      createHuman({ labels: { en: someName } }),
    ])
    await wait(100)
    const { names } = await adminReq('get', endpoint)
    names.should.be.an.Array()
    const foundRow = names.find(row => row.key === someName.toLowerCase())
    if (foundRow) {
      foundRow.value.should.equal(2)
    } else {
      // In case of numerous rows found, only count rows
      names.length.should.equal(100)
    }
  })
})
