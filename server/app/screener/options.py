import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from typing import TypedDict

from app.screener.providers.base import DividendPayment, MarketDataProvider

DAYS_PER_QUARTER = 91.25

DEFAULT_MIN_DAYS_TO_EXPIRY = 180
DEFAULT_MAX_EXPIRIES = 4


class OptionStrike(TypedDict):
    strike: float
    premium: float
    expiry: str                    # YYYY-MM-DD
    days_to_expiry: int
    protection: float              # (price - strike) / price
    call_value: float              # strike + premium
    investment_per_100: float      # (price - premium) × 100
    num_dividends: int             # ex-div dates falling on or before expiry
    roi_year: float                # annualised ROI holding to expiry
    early_exercise_date: str | None
    num_div_early_ex: int
    days_to_early_ex: int | None
    roi_year_early_ex: float | None
    ex_probability: str            # Very High / High / Medium / Low / Very Low


class TickerOptionsResult(TypedDict):
    ticker: str
    name: str
    price: float
    div_per_quarter: float
    next_ex_div_date: str | None
    future_ex_div_dates: list[str]
    recent_dividends: list[DividendPayment]
    strikes: list[OptionStrike]


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _ex_probability(time_value: float, div_per_quarter: float) -> str:
    if div_per_quarter <= 0:
        return "N/A"
    if time_value <= 0:
        return "Very High"
    ratio = time_value / div_per_quarter
    if ratio < 0.3:
        return "Very High"
    if ratio < 1.0:
        return "High"
    if ratio < 2.0:
        return "Medium"
    if ratio < 3.5:
        return "Low"
    return "Very Low"


def _early_exercise(
    time_value: float,
    div_per_quarter: float,
    future_ex_divs: list[date],
) -> tuple[int, date | None]:
    if div_per_quarter <= 0 or not future_ex_divs:
        return 0, None
    if time_value <= div_per_quarter:
        return 0, future_ex_divs[0]
    n = max(0, int(time_value / div_per_quarter) - 1)
    early_date = future_ex_divs[n] if n < len(future_ex_divs) else None
    return n, early_date


def _strike_metrics(
    strike: float,
    premium: float,
    expiry_date: date,
    price: float,
    div_per_quarter: float,
    future_ex_divs: list[date],
    today: date,
) -> OptionStrike | None:
    days = (expiry_date - today).days
    if days <= 0:
        return None

    investment = (price - premium) * 100
    if investment <= 0:
        return None

    intrinsic = max(price - strike, 0.0)
    time_value = premium - intrinsic
    protection = (price - strike) / price
    call_value = strike + premium

    num_divs = (
        sum(1 for d in future_ex_divs if d <= expiry_date)
        if future_ex_divs
        else round(days / DAYS_PER_QUARTER)
    )

    roi_year = (
        100 * ((call_value - price) + div_per_quarter * num_divs)
    ) / investment / (days / 365)

    num_div_early, early_ex_date = _early_exercise(time_value, div_per_quarter, future_ex_divs)
    days_early = (early_ex_date - today).days if early_ex_date else None

    if early_ex_date and days_early and days_early > 0:
        roi_early = (
            100 * ((call_value - price) + div_per_quarter * num_div_early)
        ) / investment / (days_early / 365)
    else:
        roi_early = None

    return OptionStrike(
        strike=round(strike, 2),
        premium=round(premium, 2),
        expiry=expiry_date.isoformat(),
        days_to_expiry=days,
        protection=round(protection, 4),
        call_value=round(call_value, 2),
        investment_per_100=round(investment, 2),
        num_dividends=num_divs,
        roi_year=round(roi_year, 4),
        early_exercise_date=early_ex_date.isoformat() if early_ex_date else None,
        num_div_early_ex=num_div_early,
        days_to_early_ex=days_early,
        roi_year_early_ex=round(roi_early, 4) if roi_early is not None else None,
        ex_probability=_ex_probability(time_value, div_per_quarter),
    )


# ---------------------------------------------------------------------------
# main fetch (sync, runs in thread)
# ---------------------------------------------------------------------------

def _fetch(
    ticker: str,
    provider: MarketDataProvider,
    price: float | None = None,
    div_per_quarter: float | None = None,
    min_days_to_expiry: int = DEFAULT_MIN_DAYS_TO_EXPIRY,
    max_expiries: int = DEFAULT_MAX_EXPIRIES,
) -> TickerOptionsResult | None:
    try:
        fund = provider.get_fundamentals(ticker)
        if fund is None:
            return None

        resolved_price = price or fund["price"]
        if resolved_price <= 0:
            return None

        annual_div = fund["annual_div"]
        resolved_div_q = div_per_quarter if div_per_quarter is not None else round(annual_div / 4, 4)
        future_ex_divs = provider.get_dividends(ticker)
        recent_dividends = provider.get_dividend_history(ticker)
        today = date.today()

        selected: list[tuple[str, date]] = []
        for exp_str in provider.get_option_expirations(ticker):
            exp_date = datetime.strptime(exp_str, "%Y-%m-%d").date()
            if (exp_date - today).days >= min_days_to_expiry:
                selected.append((exp_str, exp_date))
            if len(selected) >= max_expiries:
                break

        if not selected:
            return None

        all_strikes: list[OptionStrike] = []
        for exp_str, exp_date in selected:
            for row in provider.get_option_chain(ticker, exp_str):
                if row["strike"] >= resolved_price:
                    continue  # only ITM calls

                bid, ask, last = row["bid"], row["ask"], row["last"]
                premium = (bid + ask) / 2 if bid > 0 and ask > 0 else last
                if premium <= 0:
                    continue

                metrics = _strike_metrics(
                    strike=row["strike"],
                    premium=premium,
                    expiry_date=exp_date,
                    price=resolved_price,
                    div_per_quarter=resolved_div_q,
                    future_ex_divs=future_ex_divs,
                    today=today,
                )
                if metrics:
                    all_strikes.append(metrics)

        return TickerOptionsResult(
            ticker=ticker,
            name=fund["name"],
            price=round(resolved_price, 2),
            div_per_quarter=round(resolved_div_q, 4),
            next_ex_div_date=future_ex_divs[0].isoformat() if future_ex_divs else None,
            future_ex_div_dates=[d.isoformat() for d in future_ex_divs],
            recent_dividends=recent_dividends,
            strikes=all_strikes,
        )

    except Exception as e:
        print(f"[options] error fetching {ticker}: {e}")
        return None


# ---------------------------------------------------------------------------
# public async interface
# ---------------------------------------------------------------------------

async def get_options_analysis(
    ticker: str,
    provider: MarketDataProvider,
    price: float | None = None,
    div_per_quarter: float | None = None,
    min_days_to_expiry: int = DEFAULT_MIN_DAYS_TO_EXPIRY,
    max_expiries: int = DEFAULT_MAX_EXPIRIES,
) -> TickerOptionsResult | None:
    """Fetch ITM options chain + calculate all spreadsheet metrics for a ticker."""
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor(max_workers=1) as executor:
        return await loop.run_in_executor(
            executor, _fetch, ticker, provider, price, div_per_quarter,
            min_days_to_expiry, max_expiries,
        )
