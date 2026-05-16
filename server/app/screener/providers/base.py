from datetime import date
from typing import Protocol, TypedDict

import pandas as pd


class TickerFundamentals(TypedDict):
    name: str
    sector: str
    price: float
    annual_div: float
    div_yield: float        # decimal, e.g. 0.035
    payout_ratio: float
    market_cap: float | None
    pe_ratio: float | None
    ex_div_date: int | None  # unix timestamp


class DividendPayment(TypedDict):
    date: str   # YYYY-MM-DD
    amount: float


class OptionRow(TypedDict):
    strike: float
    bid: float
    ask: float
    last: float


class MarketDataProvider(Protocol):
    def get_price_history(self, tickers: list[str], period: str = "1y") -> pd.DataFrame:
        """Close-price DataFrame. Columns = tickers, index = dates."""
        ...

    def get_fundamentals(self, ticker: str) -> TickerFundamentals | None:
        """Fundamental data for a single ticker, or None on failure."""
        ...

    def get_dividends(self, ticker: str) -> list[date]:
        """Future projected ex-dividend dates in ascending order, derived from
        the historical payment schedule. Returns empty list if unavailable."""
        ...

    def get_dividend_history(self, ticker: str) -> list[DividendPayment]:
        """Last 4 actual dividend payments, most-recent first."""
        ...

    def get_option_expirations(self, ticker: str) -> list[str]:
        """Expiry dates as YYYY-MM-DD strings, ascending."""
        ...

    def get_option_chain(self, ticker: str, expiry: str) -> list[OptionRow]:
        """All call-side option rows for a ticker/expiry pair."""
        ...
