import type { ParsedForm } from '#controllers/images/lib/parse_form'
import type { User, UserId } from '#types/user'
import type Express from 'express'

export interface AuthentifiedReq extends Express.Request {
  user: User
}

export type Req = Express.Request | AuthentifiedReq

export type Res = Express.Response

export type Next = () => void

export type Sanitized<Params> = Params & { reqUserId?: UserId }

export interface FormReq extends AuthentifiedReq {
  form: ParsedForm
}
