import { absolutePath } from '#lib/absolute_path'
import { requireJson } from '#lib/utils/json'

const pkg = requireJson(absolutePath('root', 'package.json'))

export const softwareName = pkg.name
export const version = pkg.version
