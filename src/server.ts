// src/server.ts
//
// PHASE 13A — thin dispatcher. Behavior is UNCHANGED by default: with
// `USE_NATIVE_SERVER` unset/false, this does exactly what it always
// did (dotenv load, then Payload+Express+Next.js boot), just with that
// logic now living in ./server.payload.ts instead of inline here.
//
// When `USE_NATIVE_SERVER=true`, this delegates to ./server.native.ts
// instead, which never imports or initializes Payload. The two paths
// are loaded with `require()` (not a static `import`) specifically so
// that requiring/compiling this file does not force both branches'
// dependencies to be resolved eagerly — only the branch actually
// selected at runtime is loaded. See docs/PHASE13A_REPORT.md.

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({
  path: path.resolve(__dirname, '../.env'),
})

const useNativeServer = process.env.USE_NATIVE_SERVER === 'true'

if (useNativeServer) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, global-require
  require('./server.native').startNativeServer()
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, global-require
  require('./server.payload').startPayloadServer()
}
