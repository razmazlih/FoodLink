# Current Firebase API contracts

All three services use FIREBASE_PROJECT_ID and Application Default Credentials.
Paired demo-only emulators use FIREBASE_AUTH_EMULATOR_HOST and
FIRESTORE_EMULATOR_HOST. The Firebase runtime has no SQL connection/migration.
See [setup](firebase.md) for exact entrypoints and authentication configuration.

## Browser authentication

Both apps use Firebase Authentication email/password, Firebase-managed token
persistence and token refresh. Username remains profile data. Requests carry a
fresh Firebase ID token in Authorization: Bearer. A customer cannot enter the
manager interface; admin/restaurant_owner roles come from signed custom claims.
Old accessToken/auth localStorage sessions are removed, never reused as trust.
User changes clear cart/order caches; remaining storage key shapes are preserved.

Customer API URL defaults: UserBase http://localhost:8001/api, DishBoard
http://localhost:8002/api, OrderLine http://localhost:8003, WebSocket
ws://localhost:8003. Manager direct clients use the same service URLs and no
longer expect an unimplemented gateway /auth/login or /dashboard/stats.

## UserBase

Authenticated POST /api/users/register/ creates a Firestore profile for the
already signed-in Firebase account; GET/PATCH/PUT /api/users/profile/ reads or
updates that caller's profile. Writable fields: username, phone_number, city,
street_name, house_number. Email/UID/role are derived from authenticated identity,
not profile input. Passwords are managed solely through Firebase Auth.

Admin-only /api/admin/users/ and /api/admin/users/{uid}/ expose id,name,email,role;
existing accounts can be edited/deleted. New accounts register through the client
SDK, not an admin endpoint without a password. /api/admin/stats/ returns
{totalUsers,totalRestaurants,totalOrders,totalRevenue}; revenue counts delivered
orders. Role grants revoke refresh tokens and require signing in again.

## DishBoard (prefix /api)

- /restaurants/info/ and /{id}/: id,name,city,address,photo_url,owner_uid.
- /restaurants/opening-houers/ and /{id}/: preserve misspelled route;
  id,restaurant,day_of_week,is_open,opening_time,closing_time.
- /restaurants/opening-hours/when-open/?restaurant_id=…: opening information.
- /menu/category/?restaurant_id=…: id,restaurant,name,items.
- /menu/item/ and /{id}/: id,category,name,price,description,is_available.

Reads are public. Writes require admin or the trusted owner of that restaurant.
Category/item lists preserve nested response shapes; monetary formatting remains
decimal-compatible. Client edits send only writable fields, never nested items
or read-only IDs. Seven opening-hour records are created atomically.

## OrderLine

- POST /orders/: {user_id,restaurant_id}; user_id is the caller's Firebase UID.
- GET /orders/?user_id=… for the caller; privileged manager list uses all=true.
- GET/PUT/DELETE /orders/{id}/ subject to ownership and order state.
- POST /order-item/: {order_id,menu_item_id,quantity}; legacy submitted price is
  accepted but server menu price determines the stored amount. PUT/DELETE
  /order-item/{id}/ changes draft items and totals atomically.
- GET /order-status/{order_id}/ and POST /order-status/: {order_id,status}.
  Customers submit/cancel their own permitted orders; management delivers only
  authorized restaurant orders. Completed orders cannot be edited.
- Response order fields: id,user_id,restaurant_id,total_price,ordered_at,status;
  full order also has items. Entity IDs stay numeric; user IDs are Firebase UIDs.
- /ws/order-status/{id}: first frame {type:'auth',token:'Firebase ID token'}, then
  plain-text status messages. No token in query URLs. Auth timeout10s; unauthorized
  close4401, forbidden close4403. Client refetch obtains correct status timestamp.

Root Compose runs one OrderLine worker; a shared broker would be needed before
multiple workers can distribute status updates across processes.
