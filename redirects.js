// Build-time static redirects.
//
// Operator-managed redirects live in MongoDB and are applied at request
// time by `src/middleware.ts` — edit them at /admin/redirects. They are
// deliberately NOT read here: `next.config.js` is evaluated once at build
// time, so a redirect added afterwards would not take effect until the
// next deploy, and a database that is unreachable during a build would
// fail the build.
//
// This file is for redirects that are part of the deployment itself and
// should never depend on the database being up — a domain move, or a route
// renamed in the code. Add them to the array below.
const redirectsFn = async () => []

module.exports = redirectsFn
