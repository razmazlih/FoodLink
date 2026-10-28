> **Current runtime: Firebase Authentication + Cloud Firestore.** See [Firebase setup](../docs/firebase.md) and the root README. The SQL/Docker instructions below describe the retained legacy runtime.

# Firebase mode (current root stack)

The root stack runs `uvicorn firebase_main:app --host 0.0.0.0 --port 8000`.
`firebase_main.py` imports no SQL models and performs no startup DDL. The
standalone `main.py` application and PostgreSQL instructions below remain legacy
compatibility tools; do not run SQL initialization for Firebase mode.

Run from this service directory with the repository root on `PYTHONPATH`:

```sh
PYTHONPATH=.. venv/bin/python -m unittest discover -s tests -v
PYTHONPATH=.. venv/bin/uvicorn firebase_main:app --port 8003
```

Install `requirements.txt` first. Configure `FIREBASE_PROJECT_ID=foodlink-razmaz`
and Application Default Credentials for live access. Both emulator hosts must
be supplied together with a separate `demo-` project for local emulator work;
never mix emulator identities with the production project. Shared Firebase
initialization and token verification live in the root `foodlink_core` package.

Every OrderLine HTTP endpoint requires `Authorization: Bearer <Firebase ID token>`.
WebSocket connections use `/ws/order-status/{order_id}` and must send a first
JSON frame `{"type":"auth","token":"<Firebase ID token>"}` within 10 seconds.
Subscription begins only after token and order-access verification. Invalid or
missing authentication closes with 4401; denied order access closes with 4403.
Token query parameters are ignored. Use WSS in hosted environments.
Order IDs, item IDs, status IDs and restaurant IDs remain numeric; `user_id` is
a Firebase UID string. Customers can access only their own orders. Trusted
`admin` claims permit management access; `restaurant_owner` claims additionally
require matching `restaurants.owner_uid`. Administrators can list all orders
with `/orders/?all=true`; restaurant owners see only orders for their restaurants.

Firestore collections are `orders`, `order_items`, `order_statuses` and shared
`_counters`. Orders hold `user_id`, `restaurant_id`, `ordered_at`, `total_cents`
and `state`. Item price/name/restaurant are verified against `menu_items` on
creation. `price_cents` and `total_cents` are integers internally; outward `price`
and `total_price` retain the existing numeric API representation. Client-supplied
price and total values cannot override server prices. Item mutation plus total
updates, and status creation plus order-state updates, run in Firestore
transactions. No ownership or restaurant reassignment is allowed.

A new order is a `draft`; only drafts permit line-item edits/deletion. Quantities
must be integers from 0 to 1000. A nonempty draft may become `active`; draft or
active orders may become `cancelled`. Only an authorized restaurant owner or
administrator may change an active order to `delivered`. Final states cannot be
reopened. Status WebSocket messages retain the existing plain status-string
format and are delivered only to authenticated subscribers of the matching order.
WebSocket fan-out is process-local; run one server process for live notifications.

Firebase regression tests cover bearer authentication, ownership isolation,
restaurant ownership, forged inputs, authoritative pricing, integer-cent totals,
transaction read-before-write ordering, checkout locks, transitions and WebSocket
access. In-memory tests do not substitute for emulator integration.

---


# OrderLine API

## Introduction
The `OrderLine` API is a FastAPI-based project for managing orders, order items, and order statuses in a food ordering system. It supports real-time updates using WebSockets for order status changes.

---

## Features
1. **Order Management**:
   - Create, read, update, and delete orders.
   - Retrieve paginated lists of orders.

2. **Order Item Management**:
   - Add, update, or remove items in an order.
   - Retrieve all items for a specific order.

3. **Order Status Management**:
   - Track and update the status of orders.
   - Notify clients of real-time updates using WebSocket.

4. **Docker Integration**:
   - Fully containerized using Docker and Docker Compose for easy setup and scalability.

5. **PostgreSQL Database**:
   - The system uses PostgreSQL for persistent data storage.

---

## Installation

### Prerequisites
- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)
- Optional: Python 3.12 if running locally without Docker.

### Setup with Docker
1. Clone the repository:
   ```bash
   git clone https://github.com/razmazlih/OrderLine.git
   cd OrderLine
   ```

2. Create a `.env` file in the project root:
   ```env
   POSTGRES_USER=your_username
   POSTGRES_PASSWORD=your_password
   POSTGRES_DB=your_database_name
   POSTGRES_HOST=db
   POSTGRES_PORT=5432
   ```

3. Start the services with Docker Compose:
   ```bash
   docker-compose up --build
   ```

4. Access the API at `http://localhost:8003/docs`.

---

## Local Development (Without Docker)
1. Clone the repository and navigate to the project directory:
   ```bash
   git clone https://github.com/razmazlih/OrderLine.git
   cd OrderLine
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set environment variables:
   ```bash
   export POSTGRES_USER=your_username
   export POSTGRES_PASSWORD=your_password
   export POSTGRES_DB=your_database_name
   export POSTGRES_HOST=localhost
   export POSTGRES_PORT=5432
   ```

5. Run the application:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

6. Access the API at `http://localhost:8000/docs`.

---

## File Structure
- **`main.py`**: Entry point for the FastAPI application.
- **`database.py`**: Database connection and session setup using SQLAlchemy.
- **`models.py`**: ORM models for orders, items, and statuses.
- **`routers/`**: API route definitions.
- **`docker-compose.yml`**: Docker Compose configuration for the app and PostgreSQL.
- **`Dockerfile`**: Docker image setup for the FastAPI backend.

---

## API Endpoints
### Orders
- `POST /orders/`: Create a new order.
- `GET /orders/`: Retrieve a paginated list of orders.
- `GET /orders/{order_id}/`: Retrieve details of a specific order.
- `PUT /orders/{order_id}/`: Update an order.
- `DELETE /orders/{order_id}/`: Delete an order.

### Order Items
- `POST /order-item/`: Add an item to an order.
- `GET /order-item/{order_id}/`: Retrieve all items for an order.
- `PUT /order-item/{item_id}/`: Update an order item.
- `DELETE /order-item/{item_id}/`: Delete an order item.

### Order Status
- `POST /order-status/`: Add a new status to an order.
- `GET /order-status/{order_id}/`: Retrieve statuses for an order.

### WebSocket
- `GET /ws/order-status/{order_id}`: Real-time order status updates.

---

## Usage Example

### WebSocket Client Example
Connect to the WebSocket for real-time order status updates:
```javascript
const socket = new WebSocket("ws://localhost:8003/ws/order-status/1");

socket.onmessage = (event) => {
    console.log("Order status updated:", event.data);
};
```

### Adding a New Status
Send a `POST` request to `/order-status/`:
```json
{
    "order_id": 1,
    "status": "Preparing"
}
```

Clients subscribed to order 1 receive the plain-text status `Preparing`.

---

## Docker Configuration
- **`docker-compose.yml`**:
  - Includes two services: `db` (PostgreSQL) and `backend` (FastAPI app).
  - Configures a health check for the database.
  - Defines a shared network for communication between containers.

- **`Dockerfile`**:
  - Uses Python 3.12 as the base image.
  - Installs dependencies from `requirements.txt`.
  - Runs the FastAPI app on port `8000`.

---

## Contributing
1. Fork the repository.
2. Create a feature branch:
   ```bash
   git checkout -b feature-name
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add feature-name"
   ```
4. Push the branch:
   ```bash
   git push origin feature-name
   ```
5. Open a pull request.

---

## License
This project is licensed under the MIT License. See `LICENSE` for details.

## Isolated regression tests

Run from this service directory:

```bash
venv/bin/python -m unittest discover -s tests -v
```

Tests override the database dependency with in-memory SQLite and suppress startup
schema initialization. They cover order totals and item/status serialization,
constant query counts, the CORS default and per-order WebSocket delivery.
`total_price` remains a calculated response field; a supplied update value is
ignored, while writable order fields are updated normally. WebSocket messages
remain plain status strings and are delivered only to the matching order channel.


## Shared PostgreSQL database and explicit initialization

The existing `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`
and `POSTGRES_PASSWORD` settings remain supported. Credentials containing URL
special characters are passed through SQLAlchemy's structured URL builder.

Set `POSTGRES_SCHEMA=orderline` to isolate this service in a pre-created private
schema. Only lowercase ASCII identifiers beginning with a letter or underscore
(up to 63 characters) are accepted; `public`, `information_schema` and `pg_*`
names are rejected. The connection search path contains only that schema, with
no fallback to `public`. PostgreSQL's implicit system catalog resolution remains
available. If `POSTGRES_SCHEMA` is unset, the previous driver search path is
preserved for standalone installations. An explicitly empty schema is invalid.

For a runtime database role with DML permissions only, set `AUTO_INIT_DB=false`
to skip table creation when importing the FastAPI application. The default is
`true` for compatibility with the standalone Compose setup. Accepted boolean
values are `true`/`1`/`yes`/`on` and `false`/`0`/`no`/`off` (case insensitive).
Invalid values fail startup rather than silently selecting a mode.

Before starting runtime containers, run the explicit initializer from this
directory with a separate migrator role's `POSTGRES_USER`/`POSTGRES_PASSWORD`,
the same database and schema settings, and schema creation permissions:

```sh
python -m init_db
```

The CLI registers every OrderLine model and runs `create_all`, even when
`AUTO_INIT_DB=false`. The database/schema and roles must already exist. This
command creates missing tables; it neither copies existing data nor migrates
or alters existing tables. Keep migrator credentials out of runtime containers.
The root shared-database stack supplies separate initializer/runtime settings.

Configuration tests verify credential escaping, private-schema validation,
legacy defaults, startup without DDL and explicit model initialization, without
connecting to PostgreSQL or changing real data.
