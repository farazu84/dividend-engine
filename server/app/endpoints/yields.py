from fastapi import APIRouter

from app.logic import yields

router = APIRouter(prefix="/yields", tags=["yields"])


@router.get("")
async def get_yields(date: str | None = None):
    """Get treasury yield curve data.

    Args:
        date: Optional date in YYYY-MM-DD format. If provided, fetches yields
              for that specific date. Otherwise returns the most recent data.
    """
    return await yields.get_treasury_yields(date)


@router.get("/history/{series_id}")
def get_yield_history(series_id: str):
    """Get last week of daily yield data for a specific series."""
    return yields.get_yield_history(series_id)
