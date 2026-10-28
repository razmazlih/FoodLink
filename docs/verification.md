# Refactoring verification — 2026-10-27

## Baseline

Both React production builds passed before editing. Existing source tests were
absent in the frontends and OrderLine; Django test files were placeholders.
Source inspection found duplicate cart writes and order reads, N+1 queries,
absent-env CORS startup failure, cross-order WebSocket delivery and attempted
assignment to a calculated total. These now have regression coverage.

## Final automated checks

| Area | Command from directory | Result |
| --- | --- | --- |
| frontend | npm test -- --watchAll=false --runInBand | 12 passed |
| manager-front | npm test -- --watchAll=false --runInBand | 4 passed |
| UserBase | venv/bin/python manage.py test --settings=user_base.test_settings -v 1 | 3 passed |
| DishBoard | venv/bin/python manage.py test --settings=dish_board.test_settings -v 1 | 9 passed |
| OrderLine | venv/bin/python -m unittest discover -s tests -v | 5 passed |
| Both frontends | npm run build | passed |
| Repository | git diff --check | passed |

33 regression tests total. Query assertions cover two queries for restaurant
lists/menu categories and three for a populated order list. Cart tests verify
one decrement request, last-item deletion, persistence and rejection handling.
WebSocket tests cover real two-client isolation, failed-socket removal, lifecycle
cleanup, replacement sockets and authoritative UI timestamps.

Removed only the unused direct cra-template and dotenv frontend dependencies;
transitive build dependencies remain in the lockfiles. Build warnings for stale
Browserslist data, fs.F_OK deprecation and the manager's existing CRA Babel
plugin declaration remain. No framework or major version changes were made.

## Browser smoke test

Used production bundles served on loopback ports 18301/18302. The Playwright CLI
package could not be fetched because registry DNS was unavailable; the available
Playwright browser tool completed the checks instead.

The customer flow used actual UserBase, DishBoard and OrderLine routes served on
loopback, with dotenv disabled and test-only databases under /private/tmp.
No existing or live database was opened. Completed:

1. Login with a synthetic local account.
2. Fetch restaurant/menu, create an order and add a 25.00 item.
3. Increment/decrement cart quantity; displayed quantity and storage both end at 1.
4. Checkout shows the item name and total 25; Pay creates the local active status
   (the app's status action, not a payment-provider transaction) and clears cart.
5. Order list and detail show persisted item, total and status.
6. POST a delivered status to the isolated API; WebSocket refresh updates the
   detail screen and displays a valid timestamp without navigation.
7. Switch English/LTR ↔ Hebrew/RTL; language storage and document direction match.

No browser console errors appeared during this isolated customer flow. Manager
login renders, its navigation renders, and the restaurants page displays its
existing fetch-failure state without configured live services. Manager session
and gateway behavior are covered by mock-based tests; full manager integration
is not claimed.

## Remaining limits

- UserBase does not implement the manager's legacy /auth/login or user CRUD
  contract; the test suite confirms the missing login path. An external gateway
  must be identified before integration changes. Existing placeholder manager
  order actions and user-edit wiring were not redesigned.
- SQLite tests do not establish PostgreSQL behavior or existing migration history.
- Cloudinary upload handling is mocked; real upload/delivery is unverified.
- WebSocket subscriptions remain process-local, as before; multi-worker fan-out
  requires a separate infrastructure decision.
- No deployed services, production credentials, schema migrations, real payment
  providers or deployment workflows were exercised or changed.


## Subsequent Firebase implementation

The earlier cleanup record above describes the previous SQL baseline. The user
then selected a fresh Firestore + Firebase Authentication setup, project
foodlink-razmaz, region me-west1, with no old data to migrate. The abandoned
shared-PostgreSQL stack/transfer tools were removed. See [Firebase verification
and operation](firebase.md) for current entrypoints, cloud state and tests.

Both production UI builds pass with their real Firebase client configurations.
Firebase and legacy regression suites pass, as do7 real Auth/Firestore emulator
integration tests. Browser customer ordering and manager delivery were verified
against emulators; the customer status updated live. Cloud Admin SDK reads were
verified, with zero production users/data documents. Cloud rules/indexes and
email/password Auth configuration are applied. Backend/Hosting deployment,
real personal-account signup and real Cloudinary uploads were not performed.
