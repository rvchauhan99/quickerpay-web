---
name: build-web-screen
description: >-
  Builds or changes a QuickerPay Admin or Platform screen in quickerpay-web using
  Next.js App Router, shared components, and docs/03_MODULES_AND_SCREENS.md.
  Use when adding a page, table, filter bar, form, dashboard card, or any UI
  in quickerpay-web.
---

# Build a web screen

Do this workflow before writing UI. The stack is locked: `quickerpay-web` only, Next.js App Router, TypeScript, Tailwind. Never CRA, Vite SPA, React Router, JavaScript-only, or Shadcn as a starting kit.

## Instructions

1. Identify the route. Open the matching section in `docs/03_MODULES_AND_SCREENS.md`. **Stop** if there is no section. Do not invent a screen.
2. Read `docs/09_FRONTEND.md` for the folder map and recipe. List the shared components this screen needs.
3. If a needed shared component does not exist, **create it in `components/` first**, then the page. Do not inline a one-off table.
4. The page is a Server Component. `'use client'` only for FilterBar, DataTable pager, HeaderToggles, forms, ConfirmDialog.
5. Copy heading, column headings (including `Gateway Ref. No`), filter defaults, empty-state wording, and row actions **verbatim** from `03`.
6. Filters live in the URL via `nuqs`. FilterBar is Apply, Clear, Reload in that order. Reload is `router.refresh()`.
7. Implement Loading, Empty, Error, Success, Forbidden. Money goes through `MoneyDisplay` / `MoneyInput`. Masked fields arrive `_masked`.
8. Before calling the screen done, complete [checklist.md](checklist.md).

## Never

```text
A second frontend app
A column, filter, or widget 03 does not list
A new CSS file, a gradient, or a hex colour in a page
location.reload() for Reload
Client-side filter or pagination of money rows
A visible native <input type="file"> or browser “Choose file” chrome in a page/modal
One-off getUserMedia / camera UI outside components/forms/DocumentUpload
Unthemed dialog fields (use FormField + Input | Select | MoneyInput | DocumentUpload and --qp-* tokens)
```

## Additional resources

- Screen contract: `quickerpay-api/docs/03_MODULES_AND_SCREENS.md`
- Recipe and file map: `quickerpay-api/docs/09_FRONTEND.md`
- Wiring (RSC, rewrite, nuqs): `quickerpay-api/docs/08_ARCHITECTURE.md` section 3
- Done checklist: [checklist.md](checklist.md)
