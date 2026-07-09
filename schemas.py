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


class CategoryOut(BaseModel):
    category: str
    total_gastos: float
    total_ingresos: float
    count: int


class BudgetCreate(BaseModel):
    category: str = Field(..., min_length=1, max_length=100)
    amount: float = Field(..., gt=0)
    month: str = Field(..., pattern=r"^\d{4}-\d{2}$")


class BudgetOut(BaseModel):
    id: int
    category: str
    amount: float
    month: str
    spent: float = 0
    remaining: float = 0

    model_config = {"from_attributes": True}


class SavingsGoalCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    target_amount: float = Field(..., gt=0)
    current_amount: float = Field(0, ge=0)
    deadline: date | None = None


class SavingsGoalOut(BaseModel):
    id: int
    name: str
    target_amount: float
    current_amount: float
    deadline: date | None
    progress_pct: float = 0

    model_config = {"from_attributes": True}


class ContributeGoal(BaseModel):
    amount: float = Field(..., gt=0)


class SavingsProjection(BaseModel):
    goal_id: int
    name: str
    target_amount: float
    current_amount: float
    remaining: float
    monthly_savings_rate: float
    estimated_months: int | None
    estimated_date: str | None
    on_track: bool
