import { omitPrivateData, type UserExtraAttribute } from '#controllers/user/lib/authorized_user_data_pickers'
import { getUsersByCreationDate } from '#controllers/users/lib/users'

const sanitization = {
  limit: {},
  offset: {},
  filter: {
    allowlist: [ 'with-reports' ],
    optional: true,
  },
}

// This endpoint is admin-only, so all requests can access users abuse reports
const extraAttribute: UserExtraAttribute = 'reports'

async function controller ({ limit, offset, filter, reqUserId }) {
  const users = await getUsersByCreationDate({
    limit,
    offset,
    withReportsOnly: filter === 'with-reports',
  })
  return {
    users: users.map(omitPrivateData(reqUserId, [], extraAttribute)),
  }
}

export default { sanitization, controller }
