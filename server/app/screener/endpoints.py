import time
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.screener import options as options_logic
from app.screener import screener as screener_logic
from app.screener.options import DEFAULT_MAX_EXPIRIES, DEFAULT_MIN_DAYS_TO_EXPIRY
from app.screener.providers import get_provider
from app.screener.providers.base import MarketDataProvider
from app.screener.schemas import (
    ScreenedStockResponse,
    ScreenerResultsResponse,
    TickerOptionsResponse,
)
from app.screener.screener import DEFAULT_CRITERIA, ScreenerCriteria
from app.screener.universe import SUPPORTED_INDICES, get_merged_universe

router = APIRouter(prefix="/screener", tags=["screener"])

# Provider is created once at startup — its internal TTLCaches handle staleness.
_provider: MarketDataProvider = get_provider()

CACHE_TTL_SECONDS = 4 * 3600

# Caches the fully-computed screener results so filtering isn't re-run on every request.
_cache: dict[tuple, tuple[list, float]] = {}


def _cache_key(indices: tuple[str, ...], criteria: ScreenerCriteria) -> tuple:
    return (
        indices,
        criteria["min_drawdown"],
        criteria["min_div_yield"],
        criteria["max_payout_ratio"],
        criteria["max_settled_range"],
    )


@router.get("", response_model=ScreenerResultsResponse)
async def run_screener_endpoint(
    index: Annotated[list[str], Query(description=f"Index to screen (repeatable). Supported: {SUPPORTED_INDICES}")] = ["sp500"],
    refresh: Annotated[bool, Query(description="Bypass cache and force a fresh run")] = False,
    min_drawdown: Annotated[float, Query(ge=0, le=1, description="Min decline from 52w high (0.30 = 30%)")] = DEFAULT_CRITERIA["min_drawdown"],
    min_div_yield: Annotated[float, Query(ge=0, le=1, description="Min dividend yield (0.03 = 3%)")] = DEFAULT_CRITERIA["min_div_yield"],
    max_payout_ratio: Annotated[float, Query(ge=0, le=1, description="Max payout ratio (0.80 = 80%)")] = DEFAULT_CRITERIA["max_payout_ratio"],
    max_settled_range: Annotated[float, Query(ge=0, le=1, description="Max last-month price range (0.125 = 12.5%)")] = DEFAULT_CRITERIA["max_settled_range"],
):
    """Screen stocks by drawdown, settled range, dividend yield and payout ratio."""
    # Deduplicate and validate indices
    indices = sorted(set(index))
    invalid = [i for i in indices if i not in SUPPORTED_INDICES]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unsupported index(es): {invalid}. Choose from: {SUPPORTED_INDICES}")

    criteria = ScreenerCriteria(
        min_drawdown=min_drawdown,
        min_div_yield=min_div_yield,
        max_payout_ratio=max_payout_ratio,
        max_settled_range=max_settled_range,
    )

    key = _cache_key(tuple(indices), criteria)
    cached = _cache.get(key)
    if not refresh and cached and (time.time() - cached[1]) < CACHE_TTL_SECONDS:
        return ScreenerResultsResponse(
            indices=indices,
            total=len(cached[0]),
            cached=True,
            results=cached[0],
        )

    universe = get_merged_universe(indices)
    screened = await screener_logic.run_screener(universe, _provider, criteria)
    results = [ScreenedStockResponse(**s) for s in screened]

    _cache[key] = (results, time.time())

    return ScreenerResultsResponse(indices=indices, total=len(results), cached=False, results=results)


@router.get("/{ticker}/options", response_model=TickerOptionsResponse)
async def get_ticker_options(
    ticker: str,
    min_days_to_expiry: Annotated[int, Query(ge=1)] = DEFAULT_MIN_DAYS_TO_EXPIRY,
    max_expiries: Annotated[int, Query(ge=1, le=10)] = DEFAULT_MAX_EXPIRIES,
):
    """Fetch ITM options and metrics for any single ticker, screener not required."""
    result = await options_logic.get_options_analysis(
        ticker.upper(),
        _provider,
        min_days_to_expiry=min_days_to_expiry,
        max_expiries=max_expiries,
    )
    if result is None:
        raise HTTPException(status_code=404, detail=f"No options data found for {ticker.upper()}")

    return TickerOptionsResponse(**result, total_strikes=len(result["strikes"]))
