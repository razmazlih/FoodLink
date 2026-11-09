# Reproducible checks

## Pull-request checks (no live services)

[Quality checks](../.github/workflows/ci.yml) runs on pull requests, pushes to
`main`, and manual dispatch. It uses Python 3.12 and Node.js 22, with read-only
repository permissions and no production secrets. Backend regressions and each
React app run in separate jobs. These checks do not deploy anything.

From a fresh checkout, run the same backend checks on macOS/Linux:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r UserBase/requirements.firebase.txt -r DishBoard/requirements.firebase.txt -r OrderLine/requirements.txt
.venv/bin/python scripts/check_backend.py
```

The runner stops on the first failed suite. It covers the shared Firebase core,
local service controller, UserBase and DishBoard Firebase API mocks, and
OrderLine's Firebase mocks and legacy SQLite contracts. The full OrderLine
requirements are intentional: its legacy tests import SQLAlchemy and the test
HTTP client even though the active Firebase service does not use SQL.

Run both React apps' tests and production builds:

```sh
(cd frontend && npm ci && CI=true npm test -- --watchAll=false --runInBand && CI=true npm run build)
(cd manager-front && npm ci && CI=true npm test -- --watchAll=false --runInBand && CI=true npm run build)
```

`CI=true` makes Create React App treat build warnings as failures, matching
GitHub Actions. Do not add production credentials to make these checks pass.

## Start a disposable local demo

Prerequisites: Python 3.12, Node.js 22 with npm, Java 21+, and the official
Firebase CLI (`npm install -g firebase-tools`). From the repository root:

```sh
for service in UserBase DishBoard OrderLine; do
  python3.12 -m venv "$service/venv"
  "$service/venv/bin/python" -m pip install -r "$service/requirements.firebase.txt"
done
python3 scripts/run_firebase.py --emulators
```

Keep that terminal open. Follow the [README's fixture and UI commands](../README.md#run-locally)
to seed Demo Kitchen and open the customer and manager apps. Use only the
`demo-foodlink` project and the documented emulator accounts. Stop the API/emulator
stack with Ctrl-C; stop each UI with Ctrl-C in its own terminal.

## What CI does not prove

The default jobs do not start Firebase emulators, exercise browser flows, call
production APIs, validate deployment configuration, or send real orders.
The [explicit emulator integration command](firebase.md#tests-and-acceptance)
requires running local emulators and all three APIs first. Its seven integration
scenarios remain separate from the isolated pull-request suite. Historical test
counts elsewhere in this repository describe earlier verification, not the
result of the current commit.
