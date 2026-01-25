import asyncio
import os

import httpx
from cachetools import TTLCache
from dotenv import load_dotenv

load_dotenv()

FRED_API_KEY = os.getenv("FRED_API_KEY")
FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations"

# Cache for yield data - max 100 entries, 1 hour TTL
_yields_cache: TTLCache = TTLCache(maxsize=100, ttl=3600)

# Treasury yield series codes and their maturities
TREASURY_SERIES = [
    {"series_id": "DGS1MO", "term": "1M", "maturity_months": 1},
    {"series_id": "DGS3MO", "term": "3M", "maturity_months": 3},
    {"series_id": "DGS6MO", "term": "6M", "maturity_months": 6},
    {"series_id": "DGS1", "term": "1Y", "maturity_months": 12},
    {"series_id": "DGS2", "term": "2Y", "maturity_months": 24},
    {"series_id": "DGS3", "term": "3Y", "maturity_months": 36},
    {"series_id": "DGS5", "term": "5Y", "maturity_months": 60},
    {"series_id": "DGS7", "term": "7Y", "maturity_months": 84},
    {"series_id": "DGS10", "term": "10Y", "maturity_months": 120},
    {"series_id": "DGS20", "term": "20Y", "maturity_months": 240},
    {"series_id": "DGS30", "term": "30Y", "maturity_months": 360},
]


async def _fetch_series(
    client: httpx.AsyncClient, series: dict, date: str | None = None
) -> dict | None:
    """Fetch a single treasury series from FRED API."""
    params = {
        "series_id": series["series_id"],
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "limit": 1,
        "sort_order": "desc",
    }

    if date:
        params["observation_start"] = date
        params["observation_end"] = date

    try:
        response = await client.get(FRED_BASE_URL, params=params)
        data = response.json()
    except httpx.TimeoutException:
        print(f"Timeout fetching {series['series_id']}")
        return None

    if data.get("observations") and len(data["observations"]) > 0:
        obs = data["observations"][0]
        value = obs.get("value")

        if value and value != ".":
            return {
                "term": series["term"],
                "maturity_months": series["maturity_months"],
                "yield_rate": float(value),
                "date": obs.get("date"),
            }
    return None


async def get_treasury_yields(date: str | None = None):
    """Fetch treasury yield curve data from FRED API concurrently.

    Args:
        date: Optional date in YYYY-MM-DD format. If provided, fetches yields
              for that specific date. Otherwise returns the most recent data.

    Results are cached with LRU eviction (max 100 entries) and 1 hour TTL.
    """
    cache_key = date or "latest"

    # Check cache
    if cache_key in _yields_cache:
        return _yields_cache[cache_key]

    # Fetch from FRED
    async with httpx.AsyncClient(timeout=30.0) as client:
        tasks = [_fetch_series(client, series, date) for series in TREASURY_SERIES]
        results = await asyncio.gather(*tasks)

    yields = [r for r in results if r is not None]
    result = {"yields": yields, "date": date}

    # Cache the result
    _yields_cache[cache_key] = result

    return result


def get_yield_history(series_id: str):
    """Fetch last week of daily yield data for a specific series from FRED API."""
    # Validate series_id
    valid_series = {s["series_id"]: s for s in TREASURY_SERIES}
    
    if series_id not in valid_series:
        return {"error": f"Invalid series_id. Valid options: {list(valid_series.keys())}"}
    
    series_info = valid_series[series_id]
    observations = []

    with httpx.Client(timeout=30.0) as client:
        try:
            response = client.get(
                FRED_BASE_URL,
                params={
                    "series_id": series_id,
                    "api_key": FRED_API_KEY,
                    "file_type": "json",
                    "limit": 7,
                    "sort_order": "desc",
                },
            )
            data = response.json()
        except httpx.TimeoutException:
            return {"error": f"Timeout fetching data for {series_id}"}

        if data.get("observations"):
            for obs in data["observations"]:
                value = obs.get("value")
                if value and value != ".":
                    observations.append({
                        "date": obs.get("date"),
                        "yield_rate": float(value),
                    })

    # Reverse to get chronological order (oldest first)
    observations.reverse()

    return {
        "series_id": series_id,
        "term": series_info["term"],
        "maturity_months": series_info["maturity_months"],
        "observations": observations,
    }
