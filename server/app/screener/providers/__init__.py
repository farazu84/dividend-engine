import os

from .base import MarketDataProvider, OptionRow, TickerFundamentals
from .yfinance_provider import YFinanceProvider

__all__ = ["MarketDataProvider", "OptionRow", "TickerFundamentals", "get_provider"]


def get_provider() -> MarketDataProvider:
    """Return the configured provider based on MARKET_DATA_PROVIDER env var.

    Defaults to yfinance. Set MARKET_DATA_PROVIDER=tradier and
    TRADIER_API_TOKEN=<token> to switch to Tradier.
    """
    name = os.environ.get("MARKET_DATA_PROVIDER", "yfinance").lower()
    if name == "tradier":
        from .tradier_provider import TradierProvider
        return TradierProvider()
    return YFinanceProvider()
