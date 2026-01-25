from fastapi import APIRouter

from app.logic import yields

router = APIRouter(prefix="/yields", tags=["yields"])


@router.get("")
def get_yields():
    """Get current treasury yield curve data."""
    return yields.get_treasury_yields()


@router.get("/history/{series_id}")
def get_yield_history(series_id: str):
    """Get last week of daily yield data for a specific series."""
    return yields.get_yield_history(series_id)
