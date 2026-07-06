from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
from routers import transactions

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="API Finanzas Personales",
    description="API para gestionar ingresos y gastos personales",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions.router)


@app.get("/")
def root():
    return {"message": "API Finanzas Personales - /docs para Swagger"}
