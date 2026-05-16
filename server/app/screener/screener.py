import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import TypedDict

import pandas as pd

from app.screener.providers.base import MarketDataProvider
from app.screener.universe import IndexCompany

DAYS_PER_QUARTER = 91.25


class ScreenerCriteria(TypedDict):
    min_drawdown: float       # fraction, e.g. 0.30 = 30% below 52w high
    min_div_yield: float      # fraction, e.g. 0.03 = 3%
    max_payout_ratio: float   # fraction, e.g. 0.80 = 80%
    max_settled_range: float  # fraction, e.g. 0.125 = 12.5% last-month range


DEFAULT_CRITERIA = ScreenerCriteria(
    min_drawdown=0.30,
    min_div_yield=0.03,
    max_payout_ratio=0.80,
    max_settled_range=0.125,
)


class ScreenedStock(TypedDict):
    ticker: str
    name: str
    sector: str
    price: float
    week52_high: float
    drawdown_pct: float
    div_yield: float
    div_per_quarter: float
    payout_ratio: float
    market_cap: float | None
    pe_ratio: float | None
    price_history: list[float]


def _apply_price_filters(
    universe: list[IndexCompany],
    close: pd.DataFrame,
    criteria: ScreenerCriteria,
) -> list[dict]:
    """Pass 1: drawdown + settled check using batch close-price data."""
    cutoff = pd.Timestamp(datetime.now() - timedelta(days=31))
    qualified = []

    for company in universe:
        t = company["ticker"]
        if t not in close.columns:
            continue

        series = close[t].dropna()
        if len(series) < 30:
            continue

        current_price = float(series.iloc[-1])
        if current_price <= 0:
            continue

        week52_high = float(series.max())
        drawdown = (week52_high - current_price) / week52_high
        if drawdown < criteria["min_drawdown"]:
            continue

        last_month = series[series.index >= cutoff]
        if len(last_month) < 5:
            continue

        lo = float(last_month.min())
        hi = float(last_month.max())
        if lo <= 0 or (hi - lo) / lo > criteria["max_settled_range"]:
            continue

        n = 40
        indices = [int(round(i * (len(series) - 1) / (n - 1))) for i in range(n)]
        history = [round(float(series.iloc[i]), 4) for i in indices]

        qualified.append({
            "company": company,
            "price": round(current_price, 4),
            "week52_high": round(week52_high, 4),
            "drawdown_pct": round(drawdown, 4),
            "price_history": history,
        })

    return qualified


async def run_screener(
    universe: list[IndexCompany],
    provider: MarketDataProvider,
    criteria: ScreenerCriteria = DEFAULT_CRITERIA,
) -> list[ScreenedStock]:
    """Screen the universe using the given provider for market data.

    Pass 1 uses batch price history to filter on drawdown + settled range.
    Pass 2 fetches per-ticker fundamentals concurrently for survivors only.
    """
    tickers = [c["ticker"] for c in universe]

    close = provider.get_price_history(tickers, period="1y")
    price_qualified = _apply_price_filters(universe, close, criteria)

    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = [
            loop.run_in_executor(executor, provider.get_fundamentals, item["company"]["ticker"])
            for item in price_qualified
        ]
        fundamentals_list = await asyncio.gather(*futures)

    results: list[ScreenedStock] = []
    for item, fund in zip(price_qualified, fundamentals_list):
        if fund is None:
            continue
        if fund["div_yield"] <= criteria["min_div_yield"]:
            continue
        if fund["payout_ratio"] <= 0 or fund["payout_ratio"] >= criteria["max_payout_ratio"]:
            continue
        if fund["annual_div"] <= 0:
            continue

        c = item["company"]
        results.append(
            ScreenedStock(
                ticker=c["ticker"],
                name=fund["name"],
                sector=c["sector"] or fund["sector"],
                price=item["price"],
                week52_high=item["week52_high"],
                drawdown_pct=item["drawdown_pct"],
                div_yield=round(fund["div_yield"], 4),
                div_per_quarter=round(fund["annual_div"] / 4, 4),
                payout_ratio=round(fund["payout_ratio"], 4),
                market_cap=fund["market_cap"],
                pe_ratio=fund["pe_ratio"],
                price_history=item["price_history"],
            )
        )

    return results
