import { getTasksByScore } from '#controllers/tasks/lib/tasks'

const sanitization = {
  limit: {
    default: 10,
  },
  offset: {
    default: 0,
  },
}

const controller = async params => {
  const tasks = await getTasksByScore(params)
  return { tasks }
}

export default { sanitization, controller }
