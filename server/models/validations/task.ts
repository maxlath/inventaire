import { isArray, isNumber } from 'lodash-es'
import attributes from '../attributes/task.js'
import commonValidations from './common.js'

const { pass, entityUri, userAcct, BoundedString } = commonValidations

const taskValidations = {
  pass,
  // in attributes/task.js, attributes keys should match
  // db keys to verify if attribute is updatable
  attribute: attribute => Object.keys(attributes).includes(attribute),
  type: taskType => attributes.type.includes(taskType),
  entitiesType: entitiesType => attributes.entitiesType.includes(entitiesType),
  state: taskState => attributes.state.includes(taskState),
  suspectUri: entityUri,
  lexicalScore: isNumber,
  relationScore: isNumber,
  externalSourcesOccurrences: isArray,
  reporter: userAcct,
  clue: BoundedString(0, 500),
}

export default taskValidations
