import { getTasksByScore } from '#controllers/tasks/lib/tasks'

const sanitization = {
  limit: {
    default: 10,
  },
  offset: {
    default: 0,
  },
}

// Tasks with score are autogenerated (aka not based on users feedbacks)
// Known case: collect-entities endpoint automatically create tasks
// withkeys `lexicalScore` and `relationScore`

async function controller (params) {
  const tasks = await getTasksByScore(params)
  return { tasks }
}

export default { sanitization, controller }
