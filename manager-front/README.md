# FoodLink management UI

React / Create React App with Firebase Authentication. Use npm ci,
PORT=3002 npm start, npm test -- --watchAll=false --runInBand and npm run build.
See [Firebase operation](../docs/firebase.md) for backend and emulator setup.

Firebase web configuration is in ignored .env.local. Admin/restaurant_owner
access comes from signed Firebase custom claims. Ordinary customer accounts
cannot enter management. No raw tokens are persisted in app localStorage.

The API clients now call actual UserBase admin endpoints, DishBoard restaurant
endpoints and OrderLine order endpoints, refreshing tokens before requests.
Admin user edits are wired; management order delivery updates the server and the
customer's subscribed detail screen. New accounts register through customer
Firebase Auth. Grant the first admin explicitly using the documented operator
script; no default production admin/password exists.
