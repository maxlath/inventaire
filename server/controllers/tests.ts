import { log } from '#lib/utils/logs'
import type { Req, Res } from '#types/server'

export default {
  all: (req: Req, res: Res) => {
    // log(req.headers, 'headers')

    // useful to see text/plain bodys
    if (isPlainTextReq(req)) {
      rawBody(req, res)
    } else {
      // log(req.query, 'query')
      // log(req.body, 'body')
      res.json({ ok: true, method: req.method, body: req.body })
    }
  },
}

const isPlainTextReq = (req: Req) => req.headers['content-type'] === 'text/plain'

// Overpassing the bodyParser middleware
// as it handles json only
// cf http://stackoverflow.com/questions/22143105/node-js-express-express-json-and-express-urlencoded-with-form-submit
function rawBody (req: Req, res: Res) {
  let body = ''
  req.on('data', chunk => { body += chunk })
  req.on('end', () => {
    log(body, 'body')
    res.send(body)
  })
}
