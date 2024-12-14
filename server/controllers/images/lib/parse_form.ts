import { tmpdir } from 'node:os'
import formidable, { type Fields, type Files } from 'formidable'
import { mkdirp } from '#lib/fs'
import type { Req } from '#types/server'

const uploadDir = `${tmpdir()}/formidable`
await mkdirp(uploadDir)

export interface ParsedForm {
  fields: Fields
  files: Files
}

// Parse forms in an early middleware to not let the time to any other middleware
// to start consuming the form request stream, to avoid getting hanging requests
// See https://github.com/node-formidable/formidable/issues/959
export async function prepareFormParse (req, res, next) {
  if (!req.headers['content-type']?.startsWith('multipart/form-data')) return next()

  // Pause req stream to let parseReqForm trigger req.resume once ready
  // to get around this bug https://github.com/node-formidable/formidable/issues/959
  req.pause()
  next()
}

export async function parseReqForm (req: Req) {
  const form = formidable({ uploadDir })
  // Leave form.parse the time to setup req event listeners,
  // after `await this.writeHeaders(req.headers)`
  // See https://github.com/node-formidable/formidable/issues/959
  setImmediate(() => req.resume())
  const [ fields, files ] = await form.parse(req)
  const reqForm: ParsedForm = { fields, files }
  return reqForm
}
