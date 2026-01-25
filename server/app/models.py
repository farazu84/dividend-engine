from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime
import enum

from app.database import Base


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    FILLED = "filled"
    CANCELLED = "cancelled"


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    series_id = Column(String, nullable=False)
    term = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    yield_rate = Column(Float, nullable=False)
    status = Column(String, default=OrderStatus.PENDING.value)
    ordered_at = Column(DateTime, default=datetime.utcnow)
