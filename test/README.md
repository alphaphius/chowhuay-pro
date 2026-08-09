# Local e2e tests (run BEFORE pushing to gh-pages)

Repeatable test harness. Runs the real UI against the live Apps Script backend
from your machine, so you verify everything locally first.

## Prereqs
1. Static server on `:8765` serving the project root:
   `python3 -m http.server 8765`
2. Chrome auto-launches headless on `:9222` if not already running.

## Run
```bash
# full scenario (creates sale, restock, settings changes — writes real data)
node test/run.mjs

# read-only render smoke test (dashboard/pos/inventory/reports/settings views)
node test/run.mjs --scenario=smoke
```

## Flow
1. Regenerates `test/index.test.html` from `index.html` + `test/driver.js`
2. Launches headless Chrome (notification permission granted)
3. Drives the UI, waits for the `__DONE` title marker
4. Prints OK/FAIL checklist

## After tests
Backend carries test data (product, sale, purchase, settings changes). Reset it
with the browser-based cleanup in `test/cleanup.mjs` (node->GAS is unreliable on
some networks; cleanup runs from inside Chrome which routes fine).

## Notes
- `test/index.test.html` is generated, never commit it.
- Push to gh-pages only after the suite is green + backend cleaned.
