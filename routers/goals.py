import datetime as dt
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import SavingsGoal, Transaction
from schemas import SavingsGoalCreate, SavingsGoalOut, SavingsProjection

router = APIRouter(prefix="/savings-goals", tags=["savings-goals"])


def _to_out(goal: SavingsGoal) -> SavingsGoalOut:
    pct = (goal.current_amount / goal.target_amount * 100) if goal.target_amount > 0 else 0
    return SavingsGoalOut(
        id=goal.id,
        name=goal.name,
        target_amount=goal.target_amount,
        current_amount=goal.current_amount,
        deadline=goal.deadline,
        progress_pct=round(pct, 1),
    )


@router.post("/", response_model=SavingsGoalOut, status_code=201)
def create_goal(data: SavingsGoalCreate, db: Session = Depends(get_db)):
    goal = SavingsGoal(**data.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return _to_out(goal)


@router.get("/", response_model=list[SavingsGoalOut])
def list_goals(db: Session = Depends(get_db)):
    goals = db.query(SavingsGoal).order_by(SavingsGoal.created_at.desc()).all()
    return [_to_out(g) for g in goals]


@router.get("/{goal_id}", response_model=SavingsGoalOut)
def get_goal(goal_id: int, db: Session = Depends(get_db)):
    goal = db.get(SavingsGoal, goal_id)
    if not goal:
        raise HTTPException(404, "Meta no encontrada")
    return _to_out(goal)


@router.put("/{goal_id}", response_model=SavingsGoalOut)
def update_goal(goal_id: int, data: SavingsGoalCreate, db: Session = Depends(get_db)):
    goal = db.get(SavingsGoal, goal_id)
    if not goal:
        raise HTTPException(404, "Meta no encontrada")
    goal.name = data.name
    goal.target_amount = data.target_amount
    goal.current_amount = data.current_amount
    goal.deadline = data.deadline
    db.commit()
    db.refresh(goal)
    return _to_out(goal)


@router.delete("/{goal_id}", status_code=204)
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    goal = db.get(SavingsGoal, goal_id)
    if not goal:
        raise HTTPException(404, "Meta no encontrada")
    db.delete(goal)
    db.commit()


@router.get("/{goal_id}/projection", response_model=SavingsProjection)
def get_projection(goal_id: int, db: Session = Depends(get_db)):
    goal = db.get(SavingsGoal, goal_id)
    if not goal:
        raise HTTPException(404, "Meta no encontrada")

    remaining = max(0, goal.target_amount - goal.current_amount)

    three_months_ago = date.today() - dt.timedelta(days=90)
    rows = (
        db.query(
            func.strftime("%Y-%m", Transaction.date).label("month"),
            func.coalesce(
                func.sum(Transaction.amount).filter(Transaction.type == "ingreso"), 0
            ).label("ingresos"),
            func.coalesce(
                func.sum(Transaction.amount).filter(Transaction.type == "gasto"), 0
            ).label("gastos"),
        )
        .filter(Transaction.date >= three_months_ago)
        .group_by("month")
        .all()
    )

    if rows:
        total_net = sum(float(r.ingresos - r.gastos) for r in rows)
        monthly_rate = max(0, total_net / len(rows))
    else:
        monthly_rate = 0

    estimated_months = None
    estimated_date = None
    on_track = False

    if monthly_rate > 0 and remaining > 0:
        estimated_months = max(1, round(remaining / monthly_rate))
        try:
            est = date.today()
            for _ in range(estimated_months):
                m = est.month + 1
                y = est.year + (m - 1) // 12
                m = ((m - 1) % 12) + 1
                est = est.replace(year=y, month=m, day=min(est.day, 28))
            estimated_date = est.isoformat()
        except Exception:
            estimated_date = None

        if goal.deadline:
            months_to_deadline = (goal.deadline.year - date.today().year) * 12 + (
                goal.deadline.month - date.today().month
            )
            on_track = estimated_months <= max(1, months_to_deadline)
        else:
            on_track = True

    return SavingsProjection(
        goal_id=goal.id,
        name=goal.name,
        target_amount=goal.target_amount,
        current_amount=goal.current_amount,
        remaining=remaining,
        monthly_savings_rate=round(monthly_rate, 0),
        estimated_months=estimated_months,
        estimated_date=estimated_date,
        on_track=on_track,
    )
