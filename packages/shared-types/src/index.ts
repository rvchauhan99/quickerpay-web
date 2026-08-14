/**
 * Types shared by apps/web and apps/api.
 *
 * Money crosses the wire as a JSON number of minor units, named with a
 * `_minor` suffix, per docs/04_API_CONTRACT.md. Rates cross as integer basis
 * points named with a `_bp` suffix. Neither is ever a decimal string.
 */

export * from './envelope'
export * from './domain'
export * from './auth'
