// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // PHASE 5: several auth tests (tests/payloadCompatiblePassword.test.ts,
    // tests/AuthService.test.ts) perform real PBKDF2 hashing/verification
    // at Payload's exact parameters (25,000 iterations — see
    // src/lib/auth/password.ts) to prove native/Payload password
    // compatibility. That's deliberate and not mocked/reduced, but on
    // slower machines a single hash+verify round trip can exceed
    // Vitest's 5000ms default per-test timeout. Raised globally rather
    // than per-test since the slowdown is environment-dependent (CPU
    // speed), not specific to any one test case.
    testTimeout: 30000,
  },
})
