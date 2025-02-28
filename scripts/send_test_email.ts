#!/usr/bin/env tsx
import sendEmail from '#lib/emails/send_email'
import { newError } from '#lib/error/error'
import validations from '#models/validations/common'

const [ email ] = process.argv.slice(2)
if (!validations.email(email)) { throw new Error('invalid email') }

await sendEmail.mailerTest(email)
.catch(err => {
  throw newError('email could not be sent', 500, err)
})
