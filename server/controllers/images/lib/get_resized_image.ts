import fetch from 'node-fetch'
import { newError } from '#lib/error/error'
import { errorHandler } from '#lib/error/error_handler'
import { bundleError } from '#lib/error/pre_filled'
import { applyImageLimits, shrinkAndFormatStream } from '#lib/images'
import { endReqTimer, startReqTimer, userAgent, type RequestTimer } from '#lib/requests'
import { declareHostError, conditionallyDeclareHostError, resetBanData } from '#lib/requests_temporary_host_ban'
import { logError } from '#lib/utils/logs'
import config from '#server/config'
import type { Url } from '#types/common'
import type { Req, Res } from '#types/server'

const { mediaStorage } = config

const { maxSize } = mediaStorage.images
const oneMB = 1024 ** 2
const fetchOptions = {
  timeout: 30_000,
  headers: {
    'user-agent': userAgent,
  },
}

interface CustomRequestTimer extends RequestTimer {
  processingResponseStream?: boolean
}

export async function getResizedImage (req: Req, res: Res, url: Url, dimensions?: `${number}x${number}`) {
  let [ width, height ] = dimensions ? dimensions.split('x') : [ maxSize, maxSize ];
  [ width, height ] = applyImageLimits(width, height)

  let response, errorCode
  const timer: CustomRequestTimer = startReqTimer('get', url, fetchOptions)
  const { host } = new URL(url)
  try {
    // No need to call sanitizeUrl here, as the url should have been validated
    // in server/controllers/images/resize.js
    response = await fetch(url, fetchOptions)
    timer.processingResponseStream = true
  } catch (err) {
    conditionallyDeclareHostError(host, err)
    errorCode = err.code || err.type || err.name || err.message
    err.statusCode = 500
    err.context = { url }
    errorHandler(req, res, err)
    return
  } finally {
    endReqTimer(timer, response?.status || errorCode)
  }

  const { statusText } = response
  let { status: statusCode } = response
  const { 'content-type': contentType, 'content-length': contentLength } = response.headers.raw()

  if (statusCode >= 500) declareHostError(host)
  else resetBanData(host)

  let errMessage
  if (statusCode >= 400) {
    errMessage = `Remote response: ${statusCode} ${statusText}`
  } else if (!validImageContentType.test(contentType)) {
    errMessage = `invalid image content-type: ${contentType}`
  } else if (contentLength > (10 * oneMB)) {
    errMessage = `image is too large: ${contentLength}`
  }

  if (errMessage) {
    statusCode = statusCode === 404 ? 404 : 400
    const err = newError(errMessage, statusCode)
    // Do not pass the URL as error.context in the response to prevent leaking internal information
    // but still get it logged with the error
    err.privateContext = { url }
    errorHandler(req, res, err)
  } else {
    res.header('content-type', 'image/jpeg')
    res.header('cache-control', 'immutable')
    resizeFromStream(response.body, width, height, req, res)
  }
}

// Accepting image/*
// Accepting application/octet-stream (known case: media storages 'dumb' content type)
// Ignore charset instructions (known case: image/jpeg;charset=UTF-8)
const validImageContentType = /^(image\/[\w+]+|application\/octet-stream)/

function resizeFromStream (imageStream: ReadableStream, width: number, height: number, req: Req, res: Res) {
  let alreadySent = false
  let transmittedData = false

  function handleBufferError (buf) {
    const err = new Error(buf.toString())
    if (transmittedData || alreadySent) {
      logError(err, 'image error after some data was already sent')
    } else {
      errorHandler(req, res, err)
      alreadySent = true
    }
  }

  return shrinkAndFormatStream(imageStream, width, height)
  .stream((err, stdout, stderr) => {
    if (err != null) return errorHandler(req, res, err)
    stdout.on('error', handleBufferError)
    stderr.on('data', handleBufferError)

    // None of the above seems to catch errors for the case when graphicsmagick
    // isn't installed, so instead of doing `stdout.pipe(res)`, we check
    // if data was actually passed before determining if it is a success
    // or an error
    stdout.on('data', data => {
      if (alreadySent) return
      res.write(data)
      transmittedData = true
    })

    stdout.on('close', () => {
      // Addresses the case when the response was already sent by an error handler
      if (alreadySent) return
      if (transmittedData) {
        res.end()
        alreadySent = true
      // usually solved by `sudo apt-get install graphicsmagick`
      } else {
        const message = 'empty graphicsmagick response: make sure graphicsmagick is installed'
        bundleError(req, res, message, 500)
      }
    })
  })
}
