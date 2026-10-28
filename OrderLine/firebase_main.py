"""Firebase-only application: no SQL imports, startup DDL or data migration."""
from os import getenv

import dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from firebase_routes import router

dotenv.load_dotenv()
app = FastAPI(title='FoodLink OrderLine Firebase API')
app.add_middleware(
    CORSMiddleware,
    allow_origins=getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000').split(','),
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)
app.include_router(router)


@app.get('/healthz')
def healthz():
    return {'status': 'ok', 'service': 'orderline'}
