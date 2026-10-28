from sqlalchemy import inspect, text
from database import engine
from models.base import Base
# Register every table for the one-shot CLI as well as server startup.
from models.order_model import OrderModel  # noqa: F401
from models.order_item_model import OrderItemModel  # noqa: F401
from models.order_status_model import OrderStatusModel  # noqa: F401


def init_db():
    Base.metadata.create_all(bind=engine)
    # create_all does not add fields to existing local SQL installations.
    if 'delivery_address' not in {column['name'] for column in inspect(engine).get_columns('orders')}:
        with engine.begin() as connection:
            connection.execute(text('ALTER TABLE orders ADD COLUMN delivery_address JSON'))


if __name__ == "__main__":
    init_db()
