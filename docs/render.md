# Render deployment

`render.yaml` manages the five existing FoodLink services in the `razmaz`
workspace. The three Docker APIs use `plan: free`; the two React applications
are static sites. Firebase stays on Spark; this deployment creates no database,
paid compute, keep-alive job, or preview environment.

## Automatic builds

| Changed files | Services rebuilt |
| --- | --- |
| `frontend/**` | FoodLink-front |
| `manager-front/**` | manager-front |
| `UserBase/**` | UserBase |
| `DishBoard/**` | DishBoard |
| `OrderLine/**` | OrderLine |
| `foodlink_core/**`, `infrastructure/Dockerfile.firebase`, `.dockerignore` | All three APIs |
| Documentation, test-only changes, catalog import data, local launcher | None |

Filters include dependency manifests and lockfiles. Frontend root directories
also prevent unrelated changes from triggering builds. Backend root directories
must remain at the repository root so Docker can copy `foodlink_core`.

Render always processes Blueprint changes, manual deployments, and service
configuration changes regardless of build filters. Changing `render.yaml` can
therefore deploy affected services. Make ordinary application changes in their
own directories. Build minutes and the 750 monthly Free instance hours are
shared with other services in this workspace. Idle APIs sleep; the first
request after sleep can take about a minute.

## Credentials and runtime

- `FIREBASE_SERVICE_ACCOUNT_JSON` is a **server-only Render secret** containing
  service-account JSON for `foodlink-razmaz`. Never use a `REACT_APP_` prefix,
  commit the value, or pass it as an explicit Docker build argument. The
  Dockerfile declares only the non-sensitive `SERVICE` build argument.
- Use dedicated service identities: Firestore access plus Auth user-read for
  each API; UserBase additionally needs Auth administration for admin actions.
  Local user ADC is not a deployment credential. When the JSON variable is
  absent, the code retains Application Default Credentials for local use.
- Leave emulator host variables unset in Render. Cloud credentials are rejected
  in emulator mode.
- Each frontend needs its own Firebase Web `REACT_APP_FIREBASE_API_KEY` and
  `REACT_APP_FIREBASE_APP_ID` in Render before its initial build.
- Add `foodlink-front.onrender.com` and `manager-front.onrender.com` to Firebase
  Authentication's authorized domains. CORS and the HTTPS/WSS API addresses
  are defined in the Blueprint.
- Preserve the existing Cloudinary configuration for DishBoard uploads.
- `/healthz` verifies that each HTTP process responds, without database reads.
  Verify a restaurant read and an authenticated profile request separately.
- OrderLine runs one worker because its WebSocket subscriptions are in memory.

## Existing service URLs

- Customer: https://foodlink-front.onrender.com
- Management: https://manager-front.onrender.com
- Users: https://userbase-xqd2.onrender.com
- Restaurants: https://dishboard.onrender.com
- Orders: https://orderline.onrender.com

When connecting the Blueprint, select the existing services rather than creating
duplicate services with suffixed names. Their URLs should remain unchanged.
