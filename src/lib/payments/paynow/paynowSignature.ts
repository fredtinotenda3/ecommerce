// src/lib/payments/paynow/paynowSignature.ts
//
// Implements Paynow's hash algorithm exactly as documented at:
//   - Outbound (building a request TO Paynow):
//     https://developers.paynow.co.zw/docs/paynow/generating_hash/
//   - Inbound (validating a message FROM Paynow):
//     https://developers.paynow.co.zw/docs/paynow/validating_hash/
//
// Both directions share the same core algorithm:
//   1. Concatenate the message's field VALUES (never the keys) in the
//      exact order they appear in the message.
//   2. Append the merchant's integration key to the end of that string.
//   3. SHA-512 hash the result and uppercase the hex digest.
//
// The one difference between directions: an inbound message's values
// arrive URL-encoded (it's an `application/x-www-form-urlencoded` body)
// and must be URL-decoded *before* concatenation, whereas an outbound
// request's values are concatenated raw, before URL-encoding is applied
// to build the request body. The "hash" field itself is always excluded
// from the concatenation, in both directions.
//
// `computeSignature` below is verified against both worked examples
// published in Paynow's docs (see tests/paynowSignature.test.ts) — it
// reproduces both documented hashes exactly.

import { createHash } from 'crypto'

/** Concatenates `values` in order, appends `integrationKey`, and returns
 * the uppercase hex SHA-512 digest. Used both to sign outbound requests
 * and to independently recompute the expected hash of an inbound
 * message for comparison (see `verifyInboundHash`). */
export function computeSignature(values: string[], integrationKey: string): string {
  const base = values.join('') + integrationKey
  return createHash('sha512').update(base, 'utf8').digest('hex').toUpperCase()
}

/** Order-preserving parse of an `application/x-www-form-urlencoded`
 * body (or equivalent query string) into `[key, value]` pairs, with
 * both key and value URL-decoded (including the `+` => space
 * convention used by this encoding, which `decodeURIComponent` alone
 * does not handle).
 *
 * Order preservation matters here: Paynow's hash is positional (it
 * concatenates values in message order, not by key), so callers MUST
 * NOT re-sort or otherwise reorder the result before hashing. */
export function parseFormEncoded(body: string): Array<[string, string]> {
  const decode = (s: string): string => decodeURIComponent(s.replace(/\+/g, ' '))

  return body
    .split('&')
    .filter(pair => pair.length > 0)
    .map((pair): [string, string] => {
      const eqIndex = pair.indexOf('=')
      const rawKey = eqIndex === -1 ? pair : pair.slice(0, eqIndex)
      const rawValue = eqIndex === -1 ? '' : pair.slice(eqIndex + 1)
      return [decode(rawKey), decode(rawValue)]
    })
}

/** Recomputes the expected hash of an inbound Paynow message (a
 * `[key, value]` pair list, values already URL-decoded — e.g. from
 * `parseFormEncoded`) and compares it against the `hash` field found in
 * the same message. Returns `false` if there is no hash field at all,
 * rather than throwing — callers (see PaynowProvider) are expected to
 * turn a `false` result into a thrown error, since "no hash" and
 * "wrong hash" both mean the message cannot be trusted. */
export function verifyInboundHash(pairs: Array<[string, string]>, integrationKey: string): boolean {
  const hashEntry = pairs.find(([key]) => key.toLowerCase() === 'hash')
  if (!hashEntry) return false

  const valuesExcludingHash = pairs
    .filter(([key]) => key.toLowerCase() !== 'hash')
    .map(([, value]) => value)

  const expected = computeSignature(valuesExcludingHash, integrationKey)
  return expected === hashEntry[1].toUpperCase()
}
