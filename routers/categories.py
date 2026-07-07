from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Transaction
from schemas import CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/", response_model=list[CategoryOut])
def list_categories(
    type: str | None = Query(None, pattern="^(ingreso|gasto)$"),
    month: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
):
    q = db.query(
        Transaction.category,
        func.coalesce(
            func.sum(Transaction.amount).filter(Transaction.type == "gasto"), 0
        ).label("total_gastos"),
        func.coalesce(
            func.sum(Transaction.amount).filter(Transaction.type == "ingreso"), 0
        ).label("total_ingresos"),
        func.count(Transaction.id).label("count"),
    )

    if type:
        q = q.filter(Transaction.type == type)
    if month:
        q = q.filter(func.strftime("%Y-%m", Transaction.date) == month)

    rows = q.group_by(Transaction.category).order_by(
        func.sum(Transaction.amount).desc()
    ).all()

    return [
        CategoryOut(
            category=r.category,
            total_gastos=float(r.total_gastos),
            total_ingresos=float(r.total_ingresos),
            count=r.count,
        )
        for r in rows
    ]
