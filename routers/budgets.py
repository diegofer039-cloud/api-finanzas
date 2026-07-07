from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Budget, Transaction
from schemas import BudgetCreate, BudgetOut

router = APIRouter(prefix="/budgets", tags=["budgets"])


def _enrich(db: Session, b: Budget) -> BudgetOut:
    spent = (
        db.query(func.coalesce(func.sum(Transaction.amount), 0))
        .filter(
            Transaction.type == "gasto",
            Transaction.category == b.category,
            func.strftime("%Y-%m", Transaction.date) == b.month,
        )
        .scalar()
    )
    return BudgetOut(
        id=b.id,
        category=b.category,
        amount=b.amount,
        month=b.month,
        spent=float(spent),
        remaining=max(0, float(b.amount - spent)),
    )


@router.post("/", response_model=BudgetOut, status_code=201)
def create_budget(data: BudgetCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(Budget)
        .filter(Budget.category == data.category, Budget.month == data.month)
        .first()
    )
    if existing:
        raise HTTPException(400, "Ya existe un presupuesto para esta categoría y mes")
    budget = Budget(**data.model_dump())
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return _enrich(db, budget)


@router.get("/", response_model=list[BudgetOut])
def list_budgets(
    month: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
):
    q = db.query(Budget)
    if month:
        q = q.filter(Budget.month == month)
    budgets = q.all()
    return [_enrich(db, b) for b in budgets]


@router.put("/{budget_id}", response_model=BudgetOut)
def update_budget(
    budget_id: int, data: BudgetCreate, db: Session = Depends(get_db)
):
    budget = db.get(Budget, budget_id)
    if not budget:
        raise HTTPException(404, "Presupuesto no encontrado")
    budget.category = data.category
    budget.amount = data.amount
    budget.month = data.month
    db.commit()
    db.refresh(budget)
    return _enrich(db, budget)


@router.delete("/{budget_id}", status_code=204)
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    budget = db.get(Budget, budget_id)
    if not budget:
        raise HTTPException(404, "Presupuesto no encontrado")
    db.delete(budget)
    db.commit()
