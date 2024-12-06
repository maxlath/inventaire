import { red, yellow, grey } from 'tiny-chalk'

export const oneSecond = 1000
export const oneMinute = 60 * oneSecond
export const tenMinutes = 10 * oneMinute
export const fiveMinutes = 5 * oneMinute
export const oneHour = 60 * oneMinute
export const oneDay = 24 * oneHour
export const oneWeek = 7 * oneDay
export const oneMonth = 30 * oneDay
export const oneYear = 365 * oneDay

export function msToHumanTime (ms) {
  const seconds = Math.trunc((ms / oneSecond) % 60)
  const minutes = Math.trunc((ms / oneMinute) % 60)
  const hours = Math.trunc((ms / oneHour) % 24)
  const days = Math.trunc(ms / oneDay)
  return `${days}d ${hours}h ${minutes}m ${seconds}s`
}

export function coloredElapsedTime (startTime) {
  if (startTime == null) return ''
  const [ seconds, nanoseconds ] = process.hrtime(startTime)
  const elapsedMs = Math.round((seconds * 1000) + (nanoseconds / 1000000))
  if (elapsedMs > 10000) return red(`${elapsedMs}ms`)
  else if (elapsedMs > 1000) return yellow(`${elapsedMs}ms`)
  else return grey(`${elapsedMs}ms`)
}

export function expired (timestamp: EpochTimeStamp | string, ttl: number) {
  const epochTimestamp = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime()
  return (Date.now() - epochTimestamp) > ttl
}

export const msToHumanAge = ms => msToHumanTime(Date.now() - ms)
