import fs from 'node:fs'
import { AbortController } from 'abort-controller'
import fetch from 'node-fetch'
import { newError } from '#lib/error/error'
import { endReqTimer, startReqTimer } from '#lib/requests'
import { assertHostIsNotTemporarilyBanned, declareHostError, conditionallyDeclareHostError, resetBanData } from '#lib/requests_temporary_host_ban'
import { encodeURL } from '#lib/utils/base'
import { logError } from '#lib/utils/logs'
import type { AbsoluteUrl, Path } from '#types/common'
import isValidImageContentType from './is_valid_image_content_type.js'

const oneMB = Math.pow(1024, 2)

export default async function (url: AbsoluteUrl, path: Path) {
  url = encodeURL(url)
  const controller = new AbortController()
  let res, errorCode
  const fetchOptions = {
    timeout: 30000,
    signal: controller.signal,
    headers: {
      accept: 'image/*',
    },
  }
  const { host } = new URL(url)
  assertHostIsNotTemporarilyBanned(host)
  const timer = startReqTimer('get', url, fetchOptions)
  try {
    res = await fetch(url, fetchOptions)
    validateResponse(res, controller, url, path, host)
    return await saveFile(res.body, path)
  } catch (err) {
    errorCode = err.code || err.type || err.name || err.message
    logError(err, 'download image private error')
    conditionallyDeclareHostError(host, err)
    throw newError('could not download image', 400, { url })
  } finally {
    endReqTimer(timer, res?.status || errorCode)
  }
}

function validateResponse (response, controller, url, path, host) {
  let { status: statusCode, statusText } = response
  let { 'content-type': contentType, 'content-length': contentLength } = response.headers.raw()
  contentType = contentType?.join(';') || ''

  if (contentLength != null) contentLength = parseInt(contentLength)

  if (statusCode >= 500) declareHostError(host)
  else resetBanData(host)

  let errMessage
  if (statusCode >= 400) {
    errMessage = `Remote response: ${statusCode} ${statusText}`
  } else if (contentLength != null && contentLength > (10 * oneMB)) {
    errMessage = `image is too large: ${contentLength}`
    statusCode = 400
  } else if (contentLength != null && contentLength < 1000) {
    errMessage = `image is too small: ${contentLength}`
    statusCode = 400
  } else if (!isValidImageContentType(contentType)) {
    errMessage = `invalid image content-type: ${contentType}`
    statusCode = 400
  }

  if (errMessage != null) {
    controller.abort()
    statusCode = statusCode || 400
    throw newError(errMessage, statusCode, { url, path })
  }
}

const saveFile = (bodyStream, path) => new Promise((resolve, reject) => {
  const destinationFile = fs.createWriteStream(path)

  bodyStream
  .pipe(destinationFile)
  .on('close', resolve)
  .on('error', reject)
})
