from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app import models

router = APIRouter(prefix="/orders", tags=["orders"])


class OrderCreate(BaseModel):
    user_id: int
    series_id: str
    term: str
    amount: float
    yield_rate: float
    order_type: str = "market"  # "market" or "limit"


class OrderResponse(BaseModel):
    id: int
    user_id: int
    series_id: str
    term: str
    amount: float
    yield_rate: float
    status: str
    ordered_at: datetime

    class Config:
        from_attributes = True


class OrderWithUser(OrderResponse):
    user_name: str
    user_email: str


@router.post("", response_model=OrderResponse)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    """Create a new order."""
    # Verify user exists
    user = db.query(models.User).filter(models.User.id == order.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Market orders are immediately filled, limit orders are pending
    status = models.OrderStatus.FILLED.value if order.order_type == "market" else models.OrderStatus.PENDING.value
    
    db_order = models.Order(
        user_id=order.user_id,
        series_id=order.series_id,
        term=order.term,
        amount=order.amount,
        yield_rate=order.yield_rate,
        status=status
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order


@router.get("", response_model=list[OrderResponse])
def get_orders(user_id: int, db: Session = Depends(get_db)):
    """Get orders for a specific user."""
    # Verify user exists
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return db.query(models.Order).filter(
        models.Order.user_id == user_id
    ).order_by(models.Order.ordered_at.desc()).all()


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db)):
    """Get a specific order by ID."""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

