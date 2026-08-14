# QuickerPay Web

Next.js 15 App Router UI for QuickerPay. Tenant and Platform consoles. No database, no Redis, no secrets beyond the session cookie.

The specification lives in [quickerpay-api](https://github.com/rvchauhan99/quickerpay-api): `docs/03_MODULES_AND_SCREENS.md`, `docs/09_FRONTEND.md`. Build position: [PROGRESS.md](https://github.com/rvchauhan99/quickerpay-api/blob/main/PROGRESS.md).

## Status

Steps 1 and 2 of the platform are done on the API (tenancy + auth). This UI is a shell until step 10. Do not invent screens the spec does not list.

## Getting started

```bash
cp .env.example .env
pnpm install
pnpm dev                       # :3000, rewrites /api/v1 to QP_API_ORIGIN
```

Run [quickerpay-api](https://github.com/rvchauhan99/quickerpay-api) on port 4000 in another terminal.

Point `*.quickerpay.local` at `127.0.0.1` in `/etc/hosts`. The Tenant is resolved from the Host header, never from a query string.

## Shared packages

`packages/money` and `packages/shared-types` are copies of the API originals. After those change in the API checkout:

```bash
pnpm sync:web-packages
```

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Next.js on 3000, `/api/v1` rewritten to the API |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm test` | Money package tests |
| `pnpm build` | Production Next.js build |
