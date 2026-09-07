// Content-Security-Policy for the native application.
//
// Paynow is a redirect-based provider: the customer leaves this origin for
// Paynow's hosted payment page and comes back to /api/payments/paynow/return.
// Nothing from Paynow is embedded, framed, or scripted into this app, so no
// payment-provider host needs to appear in script-src/frame-src/connect-src.
const policies = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  'child-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'img-src': ["'self'", 'data:', 'blob:'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'frame-src': ["'self'"],
  'frame-ancestors': ["'none'"],
  'form-action': ["'self'"],
  'base-uri': ["'self'"],
  'object-src': ["'none'"],
  'connect-src': ["'self'"],
}

module.exports = Object.entries(policies)
  .map(([key, value]) => (Array.isArray(value) ? `${key} ${value.join(' ')}` : ''))
  .join('; ')
