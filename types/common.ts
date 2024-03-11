import type { uploadContainersNames } from '#controllers/images/lib/containers'

export type LatLng = [ number, number ]

export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'options' | 'head'
export type HttpHeaderKey = 'accept' | 'authorization' | 'cache-control' | 'content-type' | 'cookie' | 'user-agent' | `x-${string}`
export type HttpHeaders = Partial<Record<HttpHeaderKey, string>>

export type AbsoluteUrl = `http${string}`
export type RelativeUrl = `/${string}`
export type Url = AbsoluteUrl | RelativeUrl

export type ImageHash = string
export type ImageContainer = typeof uploadContainersNames[number]
export type ImagePath = `/img/${ImageContainer}/${ImageHash}`

export type HighResolutionTime = [ number, number ]

export type ISODate = string

export type StringifiedHashedSecretData = `{${string}}`
