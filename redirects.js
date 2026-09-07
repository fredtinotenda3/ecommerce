// Static redirects.
//
// These used to be fetched from a CMS collection at build time. With the
// CMS removed there is no such endpoint: add entries here, or read them
// from MongoDB through a repository if they need to be editable at runtime.
const redirectsFn = async () => []

module.exports = redirectsFn
