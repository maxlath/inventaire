import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { pick } from 'lodash-es'
import type { ParsedForm } from '#controllers/images/lib/parse_form'
import { parseReqForm, multipartFormContentType } from '#controllers/images/lib/parse_form'
import { isNonEmptyPlainObject } from '#lib/boolean_validations'
import { newError } from '#lib/error/error'
import { errorHandler } from '#lib/error/error_handler'
import { forwardRemoteError } from '#lib/federation/federated_requests'
import { getSignedFederatedRequestHeaders } from '#lib/federation/signed_federated_request'
import { assertArray, assertObject, assertString } from '#lib/utils/assert_types'
import { objectEntries } from '#lib/utils/base'
import { Log } from '#lib/utils/logs'
import { buildUrl } from '#lib/utils/url'
import config, { federatedMode } from '#server/config'
import type { AbsoluteUrl, HttpHeaders } from '#types/common'
import type { AuthentifiedReq, RemoteUserAuthentifiedReq, Req, Res } from '#types/server'
import { containers, uploadContainersNames } from './lib/containers.js'

const { remoteEntitiesOrigin } = config.federation
const streamRequest = remoteEntitiesOrigin?.startsWith('https') ? httpsRequest : httpRequest

const sanitization = {
  nonJsonBody: true,
  container: {
    generic: 'allowlist',
    allowlist: uploadContainersNames,
  },
}

async function controller (params, req: AuthentifiedReq | RemoteUserAuthentifiedReq, res: Res) {
  const contentType = req.headers['content-type']
  if (!contentType?.startsWith(multipartFormContentType)) {
    throw newError('invalid content-type', 400, { contentType })
  }
  const { container } = params

  if (federatedMode && container === 'entities') {
    return proxyRequestToUploadEntityImage(req as AuthentifiedReq, res)
  }

  const { putImage } = containers[container]

  const form = await parseReqForm(req)
  const files = getFilesFromFormData(form)

  return Promise.all(files.map(putImage))
  .then(indexUrlById)
  .then(Log('uploaded images'))
}

function getFilesFromFormData (formData: ParsedForm) {
  const { files } = formData

  if (!isNonEmptyPlainObject(files)) {
    throw newError('no file provided', 400, { formData })
  }

  return objectEntries(files).map(([ key, fileArray ]) => {
    assertArray(fileArray)
    const file = fileArray[0]
    assertObject(file)
    // @ts-expect-error
    assertString(file.filepath)
    Object.assign(file, {
      id: key,
      // This somehow does not have any effect: the "path" attribute is undefined when we reach transformAndPutImage
      // @ts-expect-error
      path: file.pathname,
    })
    return file
  })
}

function indexUrlById (collection) {
  const index = {}
  collection.forEach(({ id, url }) => {
    index[id] = url
  })
  return index
}

const method = 'post'
const transferedHeaders = [
  'content-type',
  'transfer-encoding',
  'connection',
]

async function proxyRequestToUploadEntityImage (req: AuthentifiedReq, res: Res) {
  const url = buildUrl('/api/images', {
    action: 'upload',
    container: 'entities',
  })
  const extraHeaders = pick(req.headers, transferedHeaders) as HttpHeaders
  const headers = await getSignedFederatedRequestHeaders(req, method, url, undefined, extraHeaders)
  const remoteUrl = `${remoteEntitiesOrigin}${url}` as AbsoluteUrl
  const forwardedReq = streamRequest(remoteUrl, { method: 'post', headers }, forwardedRes => handleRemoteResponse(req, res, remoteUrl, forwardedRes))
  req.pipe(forwardedReq)
}

function handleRemoteResponse (req: Req, res: Res, remoteUrl: AbsoluteUrl, forwardedRes: IncomingMessage) {
  const { statusCode } = forwardedRes
  let forwardedResText = ''
  forwardedRes.on('data', buf => { forwardedResText += buf.toString() })
  forwardedRes.on('close', () => {
    res.status(statusCode)
    const resBody = JSON.parse(forwardedResText)
    if (statusCode >= 400) {
      const err = newError('request error', statusCode, { method, url: remoteUrl, statusCode, resBody })
      err.body = resBody
      errorHandler(req, res, forwardRemoteError(err, remoteUrl))
    } else {
      res.json(resBody)
    }
  })
}

export default { sanitization, controller }
