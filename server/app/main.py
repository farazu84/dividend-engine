from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.endpoints import yields, health, orders
from app.database import engine
from app import models

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Treasury Yield API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(yields.router)
app.include_router(orders.router)
