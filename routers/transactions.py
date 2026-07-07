import csv
import io
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Transaction
from schemas import MonthlySummary, TransactionCreate, TransactionOut

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("/", response_model=TransactionOut, status_code=201)
def create_transaction(data: TransactionCreate, db: Session = Depends(get_db)):
    tx = Transaction(**data.model_dump())
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


@router.get("/", response_model=list[TransactionOut])
def list_transactions(
    type: str | None = Query(None, pattern="^(ingreso|gasto)$"),
    category: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=9999),
    db: Session = Depends(get_db),
):
    q = db.query(Transaction)
    if type:
        q = q.filter(Transaction.type == type)
    if category:
        q = q.filter(Transaction.category == category)
    if date_from:
        q = q.filter(Transaction.date >= date_from)
    if date_to:
        q = q.filter(Transaction.date <= date_to)
    return q.order_by(Transaction.date.desc()).offset(skip).limit(limit).all()


@router.get("/export/csv")
def export_csv(
    type: str | None = Query(None, pattern="^(ingreso|gasto)$"),
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Transaction)
    if type:
        q = q.filter(Transaction.type == type)
    if date_from:
        q = q.filter(Transaction.date >= date_from)
    if date_to:
        q = q.filter(Transaction.date <= date_to)

    rows = q.order_by(Transaction.date.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Tipo", "Monto", "Categoría", "Descripción", "Fecha"])
    for r in rows:
        writer.writerow([r.id, r.type, r.amount, r.category, r.description, r.date])

    content = "\ufeff" + output.getvalue()
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": "attachment; filename=finanzas.csv"},
    )


@router.get("/{tx_id}", response_model=TransactionOut)
def get_transaction(tx_id: int, db: Session = Depends(get_db)):
    tx = db.get(Transaction, tx_id)
    if not tx:
        raise HTTPException(404, "Transacción no encontrada")
    return tx


@router.put("/{tx_id}", response_model=TransactionOut)
def update_transaction(
    tx_id: int, data: TransactionCreate, db: Session = Depends(get_db)
):
    tx = db.get(Transaction, tx_id)
    if not tx:
        raise HTTPException(404, "Transacción no encontrada")
    for key, val in data.model_dump().items():
        setattr(tx, key, val)
    db.commit()
    db.refresh(tx)
    return tx


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(tx_id: int, db: Session = Depends(get_db)):
    tx = db.get(Transaction, tx_id)
    if not tx:
        raise HTTPException(404, "Transacción no encontrada")
    db.delete(tx)
    db.commit()


@router.get("/summary/monthly", response_model=list[MonthlySummary])
def monthly_summary(
    year: int = Query(..., ge=2020, le=2100),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(
            func.strftime("%Y-%m", Transaction.date).label("month"),
            func.coalesce(
                func.sum(Transaction.amount).filter(Transaction.type == "ingreso"), 0
            ).label("total_ingresos"),
            func.coalesce(
                func.sum(Transaction.amount).filter(Transaction.type == "gasto"), 0
            ).label("total_gastos"),
        )
        .filter(func.strftime("%Y", Transaction.date) == str(year))
        .group_by("month")
        .order_by("month")
        .all()
    )
    return [
        MonthlySummary(
            month=r.month,
            total_ingresos=float(r.total_ingresos),
            total_gastos=float(r.total_gastos),
            balance=float(r.total_ingresos - r.total_gastos),
        )
        for r in rows
    ]
