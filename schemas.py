from datetime import date
from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    type: str = Field(..., pattern="^(ingreso|gasto)$")
    amount: float = Field(..., gt=0)
    category: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    date: date


class TransactionOut(BaseModel):
    id: int
    type: str
    amount: float
    category: str
    description: str | None
    date: date

    model_config = {"from_attributes": True}


class MonthlySummary(BaseModel):
    month: str
    total_ingresos: float
    total_gastos: float
    balance: float
