# QuickerPay Web

Next.js 15 App Router UI for QuickerPay. Tenant and Platform consoles. No database, no Redis, no secrets beyond the session cookie.

**Cursor workspace:** open [`../QuickerPay/QuickerPay.code-workspace`](../QuickerPay/QuickerPay.code-workspace) (File → Open Workspace from File…) to load API + Web + GPay-Extension together.

The specification lives in the sibling API checkout [`../QuickerPay/docs/`](../QuickerPay/docs/) (also on [quickerpay-api](https://github.com/rvchauhan99/quickerpay-api)): start with `docs/03_MODULES_AND_SCREENS.md`, `docs/09_FRONTEND.md`, `docs/10_WORKSPACE.md`, `docs/FLOWS.md`. Build position: [`../QuickerPay/PROGRESS.md`](../QuickerPay/PROGRESS.md). Agent rules for this repo: [AGENTS.md](AGENTS.md).

## Status

Platform build steps 1–13 are complete on the API. This UI implements the Admin and Platform consoles per `docs/03` and `docs/09`. V1 remaining is business UAT. Do not invent screens the spec does not list.

## Getting started

```bash
cp .env.example .env
pnpm install
pnpm dev                       # :3000, rewrites /api/v1 to QP_API_ORIGIN
```

Run the API (`../QuickerPay`) on port 4000 in another terminal.

Point `*.quickerpay.local` at `127.0.0.1` in `/etc/hosts`. The Tenant is resolved from the Host header, never from a query string. For localhost, `SINGLE_TENANT` + `QP_TENANT_SLUG=demo` is the usual API mode.

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
