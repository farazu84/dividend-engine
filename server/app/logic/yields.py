import os
import httpx
from dotenv import load_dotenv

load_dotenv()

FRED_API_KEY = os.getenv("FRED_API_KEY")
FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations"

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


def get_treasury_yields():
    """Fetch treasury yield curve data from FRED API."""
    yields = []

    with httpx.Client(timeout=30.0) as client:
        for series in TREASURY_SERIES:
            try:
                response = client.get(
                    FRED_BASE_URL,
                    params={
                        "series_id": series["series_id"],
                        "api_key": FRED_API_KEY,
                        "file_type": "json",
                        "limit": 1,
                        "sort_order": "desc",
                    },
                )
                data = response.json()
            except httpx.TimeoutException:
                print(f"Timeout fetching {series['series_id']}")
                continue

            if data.get("observations") and len(data["observations"]) > 0:
                obs = data["observations"][0]
                value = obs.get("value")
                
                if value and value != ".":
                    yields.append({
                        "term": series["term"],
                        "maturity_months": series["maturity_months"],
                        "yield_rate": float(value),
                        "date": obs.get("realtime_end"),
                    })

    return {"yields": yields}


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
