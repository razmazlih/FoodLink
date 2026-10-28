# FoodLink customer UI

React / Create React App with Firebase Authentication email/password. Copy Firebase
web configuration into ignored .env.local (already configured on this workspace).
Use npm ci, npm start, npm test -- --watchAll=false --runInBand, npm run build.
For backend/emulator commands see [root README](../README.md) and
[Firebase operation](../docs/firebase.md).

Required client variables: REACT_APP_FIREBASE_PROJECT_ID,
REACT_APP_FIREBASE_API_KEY, REACT_APP_FIREBASE_AUTH_DOMAIN,
REACT_APP_FIREBASE_APP_ID. Public API defaults use localhost8001/8002/8003.
REACT_APP_USE_FIREBASE_EMULATORS=true requires a demo- project ID and connects
Auth to REACT_APP_FIREBASE_AUTH_EMULATOR_URL (default http://127.0.0.1:9099).
Do not set emulator flags for cloud builds. Client configuration is embedded at
build time. Docker builds accept Firebase client values as build arguments and
exclude .env files; never pass Firebase Admin credentials to this frontend.

Firebase owns token persistence and refresh. API requests obtain fresh bearer
tokens; WebSockets send authentication in the first frame, never the URL.
Account changes clear private cart/order caches. Existing Hebrew RTL and English
LTR layouts are retained. Username is profile information; login now uses email.
