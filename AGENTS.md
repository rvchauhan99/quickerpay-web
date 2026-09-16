# AGENTS.md

Rules for every change to this repository, human or agent.

The product specification lives in the sibling API checkout: `../QuickerPay/docs/`. When this file and the docs disagree, the docs win.

**Workspace:** open `../QuickerPay/QuickerPay.code-workspace` so API, Web, and GPay-Extension load together. Cross-repo map: `../QuickerPay/docs/10_WORKSPACE.md`. Flowcharts: `../QuickerPay/docs/FLOWS.md`.

## Role of this repo

Next.js 15 App Router UI only. No PostgreSQL, no Redis, no secrets beyond the session cookie. Data comes from NestJS over the same-origin `/api/v1` rewrite.

Paths at repo root: `app/`, `components/`, `lib/`. There is no `apps/web` folder.

## Before writing a screen

1. Read the matching section in `../QuickerPay/docs/03_MODULES_AND_SCREENS.md`. Stop if there is no section.
2. Read `../QuickerPay/docs/09_FRONTEND.md` for the recipe and component map.
3. Follow `.cursor/skills/build-web-screen/SKILL.md` and its checklist.

## Packages

`packages/money` and `packages/shared-types` are copies from the API. After those change in `../QuickerPay`:

```bash
pnpm sync:web-packages
```

## Extension-related UI

| Route | Purpose |
| --- | --- |
| `/settings/extension-devices` | List and revoke device tokens |
| `/mock/gpay` | Local mock GPay table for the extension scraper |

Extension contract: `../QuickerPay/docs/07_EXTENSION_INTEGRATION.md`. Do not invent BOT as a username; the UI label comes from `utr_entries.source`.

## Non-negotiables that show up in UI

- Money fields end `_minor`. Rates end `_bp`. Use `MoneyDisplay` / `MoneyInput`. Never divide by 100 in a page.
- Masked fields arrive `_masked`. Do not hide full account numbers in CSS.
- Glossary and banned words: `../QuickerPay/docs/00_START_HERE.md` and `.cursor/rules/naming-and-glossary.mdc`.
- Build position: `../QuickerPay/PROGRESS.md` (step 13 complete; V1 remaining is business UAT).
