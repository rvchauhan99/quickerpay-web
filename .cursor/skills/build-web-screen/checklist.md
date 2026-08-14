# Screen definition of done

From `docs/03_MODULES_AND_SCREENS.md` section 6. A screen is not finished until every box is true.

```text
[ ] The route is gated by menu permission on the server, not only hidden in the nav
[ ] Every list is paginated, filtered and sorted server-side
[ ] Loading, empty, error, success and forbidden states all exist
[ ] Every money value uses MoneyDisplay and integer minor units end to end
[ ] Every rate uses RateInput and basis points end to end
[ ] Sensitive fields are masked per 03 section 2.5, and reveals are audited
[ ] Every mutation writes an audit record
[ ] Every financial mutation sends an idempotency key
[ ] Every destructive action has a confirmation dialog
[ ] Banking scope is enforced in the query, verified by a test with a foreign id
[ ] Export respects the filters and is permission-gated, and is disabled when empty
[ ] Every list has Apply, Clear and Reload, and Clear restores the default status
[ ] Column headings match 03 exactly, including "Gateway Ref. No"
[ ] No row is ever hard-deleted; destructive actions move to a terminal status
[ ] The screen is usable on a 1280px laptop and a tablet
```

Phase 1 Admin screens also match heading, filter set, column set, default filters, empty-state wording and row actions from the corresponding `03` section.
