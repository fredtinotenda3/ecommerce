// tests/paynowConfig.test.ts
import { describe, expect, it } from 'vitest'
import { loadPaynowConfig, PaynowConfigError } from '../src/lib/payments/paynow/paynowConfig'

describe('loadPaynowConfig', () => {
  it('loads a valid configuration from env vars', () => {
    const config = loadPaynowConfig({
      PAYNOW_INTEGRATION_ID: 'id-123',
      PAYNOW_INTEGRATION_KEY: 'key-456',
      PAYNOW_RESULT_URL: 'https://shop.example.com/paynow/result',
      PAYNOW_RETURN_URL: 'https://shop.example.com/paynow/return',
      PAYNOW_MODE: 'live',
    })

    expect(config).toEqual({
      integrationId: 'id-123',
      integrationKey: 'key-456',
      resultUrl: 'https://shop.example.com/paynow/result',
      returnUrl: 'https://shop.example.com/paynow/return',
      mode: 'live',
    })
  })

  it('defaults mode to "test" when unset', () => {
    const config = loadPaynowConfig({
      PAYNOW_INTEGRATION_ID: 'id-123',
      PAYNOW_INTEGRATION_KEY: 'key-456',
    })

    expect(config.mode).toBe('test')
  })

  it('defaults mode to "test" for an unrecognized value (fails safe)', () => {
    const config = loadPaynowConfig({
      PAYNOW_INTEGRATION_ID: 'id-123',
      PAYNOW_INTEGRATION_KEY: 'key-456',
      PAYNOW_MODE: 'production', // not a recognized value
    })

    expect(config.mode).toBe('test')
  })

  it('throws PaynowConfigError when PAYNOW_INTEGRATION_ID is missing', () => {
    expect(() => loadPaynowConfig({ PAYNOW_INTEGRATION_KEY: 'key-456' })).toThrow(
      PaynowConfigError,
    )
  })

  it('throws PaynowConfigError when PAYNOW_INTEGRATION_KEY is missing', () => {
    expect(() => loadPaynowConfig({ PAYNOW_INTEGRATION_ID: 'id-123' })).toThrow(
      PaynowConfigError,
    )
  })
})
