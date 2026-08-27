// tests/paynowSignature.test.ts
//
// Verifies computeSignature/parseFormEncoded/verifyInboundHash against
// the exact worked examples published by Paynow at:
//   - https://developers.paynow.co.zw/docs/paynow/generating_hash/
//   - https://developers.paynow.co.zw/docs/paynow/validating_hash/
// These are real fixture values from Paynow's own documentation, not
// invented — if these tests pass, the hash algorithm is byte-for-byte
// correct against the documented spec.

import { describe, expect, it } from 'vitest'
import {
  computeSignature,
  parseFormEncoded,
  verifyInboundHash,
} from '../src/lib/payments/paynow/paynowSignature'

const DOC_INTEGRATION_KEY = '3e9fed89-60e1-4ce5-ab6e-6b1eb2d4f977'

describe('computeSignature', () => {
  it('matches the outbound worked example from the Generating Hash docs', () => {
    // id=1201 reference=TEST REF amount=99.99
    // additionalinfo=A test ticket transaction
    // returnurl=http://www.google.com/search?q=returnurl
    // resulturl=http://www.google.com/search?q=resulturl status=Message
    const values = [
      '1201',
      'TEST REF',
      '99.99',
      'A test ticket transaction',
      'http://www.google.com/search?q=returnurl',
      'http://www.google.com/search?q=resulturl',
      'Message',
    ]

    const hash = computeSignature(values, DOC_INTEGRATION_KEY)

    expect(hash).toBe(
      '2A033FC38798D913D42ECB786B9B19645ADEDBDE788862032F1BD82CF3B92DEF84F316385D5B40DBB35F1A4FD7D5BFE73835174136463CDD48C9366B0749C689',
    )
  })

  it('is sensitive to value order (hash is positional, not keyed)', () => {
    const a = computeSignature(['foo', 'bar'], 'key')
    const b = computeSignature(['bar', 'foo'], 'key')
    expect(a).not.toBe(b)
  })

  it('is sensitive to the integration key', () => {
    const a = computeSignature(['foo', 'bar'], 'key-one')
    const b = computeSignature(['foo', 'bar'], 'key-two')
    expect(a).not.toBe(b)
  })
})

describe('parseFormEncoded', () => {
  it('preserves field order and URL-decodes keys and values', () => {
    const body = 'reference=ABC123&paynowreference=123456&amount=1.00&status=Awaiting+Delivery'
    const pairs = parseFormEncoded(body)

    expect(pairs).toEqual([
      ['reference', 'ABC123'],
      ['paynowreference', '123456'],
      ['amount', '1.00'],
      ['status', 'Awaiting Delivery'],
    ])
  })

  it('URL-decodes percent-encoded values (e.g. URLs containing ? and =)', () => {
    const body = 'pollurl=https%3a%2f%2fstaging.paynow.co.zw%2fInterface%2fCheckPayment%2f%3fguid%3dabc'
    const pairs = parseFormEncoded(body)

    expect(pairs).toEqual([
      ['pollurl', 'https://staging.paynow.co.zw/Interface/CheckPayment/?guid=abc'],
    ])
  })

  it('returns an empty array for an empty body', () => {
    expect(parseFormEncoded('')).toEqual([])
  })
})

describe('verifyInboundHash', () => {
  it('matches the inbound worked example from the Validating Hash docs', () => {
    const rawMessage =
      'status=Ok&browserurl=https%3a%2f%2fstaging.paynow.co.zw%2fPayment%2fConfirmPayment%2f9510' +
      '&pollurl=https%3a%2f%2fstaging.paynow.co.zw%2fInterface%2fCheckPayment%2f%3fguid%3dc7ed41da-0159-46da-b428-69549f770413' +
      '&paynowreference=9510' +
      '&hash=750DD0B0DF374678707BB5AF915AF81C228B9058AD57BB7120569EC68BBB9C2EFC1B26C6375D2BC562AC909B3CD6B2AF1D42E1A5E479FFAC8F4FB3FDCE71DF4D'

    const pairs = parseFormEncoded(rawMessage)

    expect(verifyInboundHash(pairs, DOC_INTEGRATION_KEY)).toBe(true)
  })

  it('returns false when the hash has been tampered with', () => {
    const rawMessage = 'reference=ABC123&amount=1.00&status=Paid&hash=0000000000000000'
    const pairs = parseFormEncoded(rawMessage)

    expect(verifyInboundHash(pairs, 'some-integration-key')).toBe(false)
  })

  it('returns false when a field value has been tampered with post-signing', () => {
    // Same as the valid example above, but with the amount changed —
    // simulates an attacker altering the paid amount in transit.
    const validPairs = parseFormEncoded(
      'status=Ok&browserurl=https%3a%2f%2fstaging.paynow.co.zw%2fPayment%2fConfirmPayment%2f9510' +
        '&pollurl=https%3a%2f%2fstaging.paynow.co.zw%2fInterface%2fCheckPayment%2f%3fguid%3dc7ed41da-0159-46da-b428-69549f770413' +
        '&paynowreference=9510' +
        '&hash=750DD0B0DF374678707BB5AF915AF81C228B9058AD57BB7120569EC68BBB9C2EFC1B26C6375D2BC562AC909B3CD6B2AF1D42E1A5E479FFAC8F4FB3FDCE71DF4D',
    )
    const tamperedPairs: Array<[string, string]> = validPairs.map(([key, value]) =>
      key === 'paynowreference' ? [key, '999999'] : [key, value],
    )

    expect(verifyInboundHash(tamperedPairs, DOC_INTEGRATION_KEY)).toBe(false)
  })

  it('returns false when there is no hash field at all', () => {
    const pairs = parseFormEncoded('reference=ABC123&status=Paid')
    expect(verifyInboundHash(pairs, 'some-integration-key')).toBe(false)
  })
})
