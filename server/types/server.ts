import type { ParsedForm } from '#controllers/images/lib/parse_form'
import type { RelativeUrl, Host } from '#types/common'
import type { User, UserId } from '#types/user'
import type Express from 'express'
import type { SetOptional } from 'type-fest'

export interface AuthentifiedReq extends Express.Request {
  user: User
}

/** See https://en.wikipedia.org/wiki/Acct_URI_scheme */
export type AccountUri = `${UserId}@${Host}`

export interface RemoteUser {
  acct: AccountUri
}

export interface SignedReq extends Express.Request {
  signed: {
    host: Host
  }
}

export type MaybeSignedReq = SetOptional<SignedReq, 'signed'>

export interface RemoteUserAuthentifiedReq extends SignedReq {
  remoteUser: RemoteUser
}

export type Req = Express.Request | AuthentifiedReq | SignedReq

export type Res = Express.Response & { warnings?: string[] }

export type Next = () => void

export type Sanitized<Params> = Params & { reqUserId?: UserId }

export interface FormReq extends AuthentifiedReq {
  form: ParsedForm
}

export type Middleware = (req: Req, res: Res, next: Next) => void

export type PathSpecificMiddleware = [ RelativeUrl, Middleware ]
