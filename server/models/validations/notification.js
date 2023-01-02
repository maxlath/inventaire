import assert_ from '#lib/utils/assert_types'
import { types } from '../attributes/notification.js'
import Group from '../group.js'
import { pass } from './common.js'

const validations = {
  pass,
  type: type => types.includes(type),
  data: (data, { type }) => {
    assert_.object(data)
    dataValidationPerType[type](data)
    return true
  }
}

export default validations

const dataValidationPerType = {
  friendAcceptedRequest: ({ user }) => {
    validations.pass('userId', user)
  },
  groupUpdate: ({ group, user, attribute, previousValue, newValue }) => {
    validations.pass('groupId', group)
    validations.pass('userId', user)
    validations.pass('attribute', attribute)
    Group.validations.pass(attribute, previousValue)
    Group.validations.pass(attribute, newValue)
  },
  userMadeAdmin: ({ group, user }) => {
    validations.pass('groupId', group)
    validations.pass('userId', user)
  },
}
