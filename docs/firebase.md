# Firebase implementation and operation

## Cloud configuration

- Project: foodlink-razmaz; default Firestore database, Standard Native, me-west1.
- Firestore deletion protection enabled; project remains Spark (no billing upgrade).
- Firebase Authentication: email/password enabled through the Firebase console;
  localhost and 127.0.0.1 development domains configured.
- Separate registered customer and manager web applications; their Firebase web
  configuration is saved in ignored `.env.local` files, not server credentials.
- Client Firestore rules deny all direct browser reads/writes. All data goes
  through authenticated server APIs. Rules and the checked-in indexes deployed.
- No Hosting/backend deployment and no production users or sample data created.

## Runtime

| Service | Firebase entrypoint | Port |
| --- | --- | --- |
| UserBase | DJANGO_SETTINGS_MODULE=user_base.firebase_settings | 8001 |
| DishBoard | DJANGO_SETTINGS_MODULE=dish_board.firebase_settings | 8002 |
| OrderLine | uvicorn firebase_main:app | 8003 |

Set PYTHONPATH to the repository root. `scripts/run_firebase.py` handles this and
starts/stops only its own child processes. `--emulators` starts paired Auth and
Firestore emulators under demo-foodlink; cloud mode refuses leftover emulator
hosts. Core initialization requires an explicit project ID, rejects partial
emulation and refuses real project IDs in emulator mode. Default credentials are
used only for cloud mode; emulators use anonymous credentials.

Use requirements.firebase.txt for the SQL-free runtime. requirements.txt retains
legacy SQL/test dependencies as well. Docker's root compose.yaml uses a shared
Firebase Dockerfile and has no PostgreSQL service or migration jobs. Provide a
credential file outside Git via GOOGLE_APPLICATION_CREDENTIALS, mounted read-only;
workload identity is preferred for deployed servers. Docker startup was not run
because Docker Desktop is stopped; the Compose configuration was validated.
No new service-account private key was generated.

Production service identities need Firestore access; UserBase additionally needs
Auth administration for verified admin operations. DishBoard/OrderLine need Auth
user-read access for revocation verification. Firestore Admin SDK bypasses client
rules, so API authorization remains mandatory. Limit deployment IAM to these
capabilities; never ship Admin credentials to browsers. Cloudinary image upload
remains the existing provider and needs its own server configuration.

## Data and permissions

Collections: users (Firebase UID keys), restaurants, opening_hours,
menu_categories, menu_items, orders, order_items, order_statuses. Entity IDs remain
numeric to preserve UI contracts; transactional _counters allocate IDs. Internal
_restaurant_keys preserves restaurant name/address uniqueness. These internal
collections are never client-writable.

- Users sign in with email/password; username is profile/display information.
- Profiles have an allowlist. Email/role are not accepted from profile payloads.
- Roles come only from verified custom claims: customer, restaurant_owner, admin.
- Public restaurant/menu reads are allowed; mutations require admin or verified
  ownership. Parent checks, uniqueness and cascades are transactional.
- Order ownership is the Firebase UID. Forged user IDs and cross-account access
  are rejected. Server menu data determines prices and restaurant membership.
- Order totals use integer cents; line/total changes and status/history changes
  are atomic. Customer checkout/cancellation and manager delivery have different
  permissions; completed orders are immutable.
- WebSocket authentication is a first JSON frame `{type:"auth",token:"…"}` within
  10 seconds, followed by existing plain status messages. Tokens never enter URLs.
  The client refreshes the order for authoritative timestamps. One OrderLine
  worker is configured; cross-worker fan-out needs a future broker.
- Firebase handles persistence/token refresh; raw tokens are not stored in the
  app's own localStorage keys. User changes clear private order/cart caches.

Numeric counters are suitable for the current modest workload. They serialize
allocation; bounded jittered retry handles transient contention. High-volume
allocation would require a separate ID strategy, not unbounded retries.

## First production administrator

Register the intended account through the customer app first. Then an authorized
operator grants a role explicitly, using ADC and the real project:

```sh
PYTHONPATH=. FIREBASE_PROJECT_ID=foodlink-razmaz \
UserBase/venv/bin/python scripts/set_firebase_role.py \
  --email YOUR_REGISTERED_EMAIL --role admin
```

Sign in again afterwards. Do not run this against an arbitrary email. The command
does not create an account or set/change passwords. Restaurant-owner grants are
similarly explicit, and restaurants reference the owner's Firebase UID.

## Tests and acceptance

```sh
# Shared core unit tests
PYTHONPATH=. UserBase/venv/bin/python -m unittest discover -s tests -p test_firebase_core.py -v
# Firebase Django tests (run from the corresponding service directory)
PYTHONPATH=.. venv/bin/python manage.py test users.firebase_tests --settings=user_base.firebase_settings
PYTHONPATH=.. venv/bin/python manage.py test restaurant.firebase_tests --settings=dish_board.firebase_settings
# OrderLine, from OrderLine directory
PYTHONPATH=.. venv/bin/python -m unittest discover -s tests -v
# Both UIs, from their own directories
npm test -- --watchAll=false --runInBand
npm run build
```

With emulators and the three APIs running:

```sh
PYTHONPATH=. FOODLINK_FIREBASE_INTEGRATION=1 FIREBASE_PROJECT_ID=demo-foodlink \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
OrderLine/venv/bin/python -m unittest discover -s tests -p test_firebase_integration.py -v
```

Integration tests refuse real projects/nonloopback hosts, create randomized
accounts/documents and clean up only their own records. They cover profile/admin
boundaries, ownership, authoritative prices/totals, transaction concurrency,
WebSocket isolation and confirmation that Firebase entrypoints import no SQL.

Browser acceptance used production bundles against emulators: customer login,
restaurant/menu, cart increments/decrements, checkout, manager login/dashboard,
order listing and Mark Delivered. The customer's open detail page updated live
with the delivered status and a valid timestamp. Hebrew RTL/English LTR remain.
Read-only cloud Admin SDK access was verified for Firestore and Auth. The
launcher was tested in both emulator and real-project modes; local manager CORS
was verified on all three APIs. Live
personal-account signup, real image upload and deployment remain unverified.


Final automated count: 105 passing tests (UserBase12, DishBoard23, OrderLine21,
shared core20, customer15, manager7, real emulator integration7). Both UI
production builds pass. Existing CRA/Browserslist deprecation warnings remain.
