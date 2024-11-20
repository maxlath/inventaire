// A server-wide event bus
import { EventEmitter } from 'node:events'
import { warn, logError } from '#lib/utils/logs'
import config from '#server/config'

export const radio = new EventEmitter()

// It's convenient in tests to have the guaranty that event listeners were called,
// but in production, that would mean delaying API responses for secondary actions
// (setting notifications, sending emails, analytics, etc)
const waitForListeners = config.env.includes('tests')

export let emit

// In one case, emit is an async function, and in the other a sync function,
// For developers comfort, it should be fine to always `await` emit calls
// but it does mean that what follows the call to `emit` will be called on the next tick
// See https://stackoverflow.com/a/53113299/3324977
if (waitForListeners) {
  emit = async (eventName, ...args) => {
    const listeners = radio.listeners(eventName)
    if (listeners.length === 0) {
      const context = JSON.stringify({ eventName, args })
      const stringifiedContext = context.length > 100 ? context.slice(0, 100) + '…' : context
      warn(`no event listner found: ${stringifiedContext}`)
    } else {
      await Promise.all(listeners.map(triggerAndWait(eventName, args)))
    }
  }
} else {
  emit = radio.emit.bind(radio)
}

const triggerAndWait = (eventName, args) => async listener => {
  try {
    await listener(...args)
  } catch (err) {
    logError(err, `${eventName} event listener error`)
  }
}
