import { afterEach, describe, expect, it, vi } from 'vitest'
import { isLabConsole, isMockGpayAllowed } from './lab'

describe('isLabConsole', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is false when NEXT_PUBLIC_QP_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_QP_ENV', 'production')
    expect(isLabConsole()).toBe(false)
  })

  it('is false when NEXT_PUBLIC_QP_ENV is prod', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_QP_ENV', 'prod')
    expect(isLabConsole()).toBe(false)
  })

  it('is false for NODE_ENV=production even if NEXT_PUBLIC_QP_ENV=local', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_QP_ENV', 'local')
    expect(isLabConsole()).toBe(false)
  })

  it('is true for local lab under development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_QP_ENV', 'local')
    expect(isLabConsole()).toBe(true)
  })

  it('is true for testing under development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_QP_ENV', 'testing')
    expect(isLabConsole()).toBe(true)
  })

  it('is true when env name is unset under development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_QP_ENV', '')
    expect(isLabConsole()).toBe(true)
  })
})

describe('isMockGpayAllowed', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is true for test on a production Next build', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_QP_ENV', 'test')
    expect(isMockGpayAllowed()).toBe(true)
  })

  it('is true for local on a production Next build', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_QP_ENV', 'local')
    expect(isMockGpayAllowed()).toBe(true)
  })

  it('is false when NEXT_PUBLIC_QP_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_QP_ENV', 'production')
    expect(isMockGpayAllowed()).toBe(false)
  })

  it('is false when NEXT_PUBLIC_QP_ENV is prod', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_QP_ENV', 'prod')
    expect(isMockGpayAllowed()).toBe(false)
  })

  it('is false when the env name is unset on a production build', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_QP_ENV', '')
    expect(isMockGpayAllowed()).toBe(false)
  })

  it('is true when the env name is unset under development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_QP_ENV', '')
    expect(isMockGpayAllowed()).toBe(true)
  })
})
