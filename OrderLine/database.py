from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

import dotenv
from db_config import database_settings

dotenv.load_dotenv()

SQLALCHEMY_DATABASE_URL, connection_args = database_settings()
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connection_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
