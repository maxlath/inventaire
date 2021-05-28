const should = require('should')
const getBnbSeedFromIsbn = require('data/bnb/get_bnb_seed_from_isbn')

describe('get_bnb_seed_from_isbn', () => {
  it('should get an entry from a known ISBN', async () => {
    const entry = await getBnbSeedFromIsbn('9781903765234')
    entry.edition.claims['wdt:P5199'].should.equal('012938091')
    entry.edition.claims['wdt:407'].should.equal('Q1860')
    entry.authors[0].claims['wdt:P5361'].should.equal('OBrienJim1950-')
    entry.authors[0].claims['wdt:P213'].should.equal('0000000067818190')
    entry.authors[0].claims['wdt:P214'].should.equal('75843307')
  })

  it('should not get an entry from an unknown ISBN', async () => {
    const entry = await getBnbSeedFromIsbn('978-3-9818987-4-3')
    should(entry).not.be.ok()
  })
})
