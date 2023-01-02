import sub from 'subleveldown'
import memoize from '#lib/utils/memoize'
import assert_ from '#lib/utils/assert_types'
import { generalDb } from './get_db.js'

// Available encodings: https://github.com/Level/codec#builtin-encodings
export default memoize((dbName, valueEncoding) => {
  assert_.string(dbName)
  assert_.string(valueEncoding)
  return sub(generalDb, dbName, { valueEncoding })
})
