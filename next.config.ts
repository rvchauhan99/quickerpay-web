import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { NextConfig } from 'next'

const rootEnv = resolve(__dirname, '.env')
if (existsSync(rootEnv)) {
  for (const line of readFileSync(rootEnv, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq)
    const value = trimmed.slice(eq + 1)
    if (process.env[key] === undefined) process.env[key] = value
  }
}

const apiOrigin = process.env.QP_API_ORIGIN ?? 'http://127.0.0.1:4000'

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@quickerpay/money', '@quickerpay/shared-types'],
  env: {
    QP_DEPLOYMENT_MODE: process.env.QP_DEPLOYMENT_MODE ?? 'MULTI_TENANT',
    QP_ROOT_DOMAIN: process.env.QP_ROOT_DOMAIN ?? 'quickerpay.local',
  },
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${apiOrigin}/api/v1/:path*` },
      { source: '/health', destination: `${apiOrigin}/health` },
    ]
  },
  poweredByHeader: false,
}

export default config
