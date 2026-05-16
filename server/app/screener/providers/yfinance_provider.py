import threading
from datetime import date, timedelta

import pandas as pd
import yfinance as yf
from cachetools import TTLCache

from .base import DividendPayment, OptionRow, TickerFundamentals

_4H = 4 * 3600
_1H = 3600


class YFinanceProvider:
    def __init__(self) -> None:
        self._price_cache: TTLCache = TTLCache(maxsize=5, ttl=_4H)
        self._fund_cache: TTLCache = TTLCache(maxsize=600, ttl=_4H)
        self._div_cache: TTLCache = TTLCache(maxsize=600, ttl=_4H)
        self._exp_cache: TTLCache = TTLCache(maxsize=200, ttl=_1H)
        self._chain_cache: TTLCache = TTLCache(maxsize=2000, ttl=_1H)
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Price history
    # ------------------------------------------------------------------

    def get_price_history(self, tickers: list[str], period: str = "1y") -> pd.DataFrame:
        key = (tuple(sorted(tickers)), period)
        with self._lock:
            if key in self._price_cache:
                return self._price_cache[key]

        raw = yf.download(tickers, period=period, progress=False, auto_adjust=True)
        close: pd.DataFrame = raw["Close"] if isinstance(raw.columns, pd.MultiIndex) else raw

        with self._lock:
            self._price_cache[key] = close
        return close

    # ------------------------------------------------------------------
    # Fundamentals
    # ------------------------------------------------------------------

    def get_fundamentals(self, ticker: str) -> TickerFundamentals | None:
        with self._lock:
            if ticker in self._fund_cache:
                return self._fund_cache[ticker]

        try:
            info = yf.Ticker(ticker).info
            price = float(info.get("previousClose") or info.get("regularMarketPrice") or 0)
            if price <= 0:
                return None

            # yfinance 1.3+ returns dividendYield as a percentage (e.g. 3.5), not decimal
            div_yield = (info.get("dividendYield") or 0.0) / 100
            annual_div = float(info.get("trailingAnnualDividendRate") or 0.0)
            payout_ratio = float(info.get("payoutRatio") or 0.0)
            market_cap = info.get("marketCap") or None
            pe_raw = info.get("trailingPE") or info.get("forwardPE") or None

            result = TickerFundamentals(
                name=info.get("longName") or info.get("shortName") or ticker,
                sector=info.get("sector") or "",
                price=price,
                annual_div=annual_div,
                div_yield=div_yield,
                payout_ratio=payout_ratio,
                market_cap=market_cap,
                pe_ratio=round(pe_raw, 1) if pe_raw else None,
                ex_div_date=info.get("exDividendDate"),
            )
            with self._lock:
                self._fund_cache[ticker] = result
            return result
        except Exception:
            return None

    # ------------------------------------------------------------------
    # Dividend schedule
    # ------------------------------------------------------------------

    def _fetch_div_data(self, ticker: str) -> tuple[list[date], list[DividendPayment]]:
        """Single yfinance fetch that produces both future projected dates and
        the last 4 historical payments. Result is cached for 4 hours."""
        with self._lock:
            if ticker in self._div_cache:
                return self._div_cache[ticker]

        try:
            divs = yf.Ticker(ticker).dividends
            if divs.empty or len(divs) < 2:
                result: tuple[list[date], list[DividendPayment]] = ([], [])
                with self._lock:
                    self._div_cache[ticker] = result
                return result

            div_dates = [ts.date() for ts in divs.index]
            recent = div_dates[-8:]
            intervals = [(recent[i + 1] - recent[i]).days for i in range(len(recent) - 1)]
            avg_interval = round(sum(intervals) / len(intervals))

            today = date.today()
            anchor = div_dates[-1]
            while anchor <= today:
                anchor += timedelta(days=avg_interval)

            future: list[date] = []
            d = anchor
            for _ in range(12):
                future.append(d)
                d += timedelta(days=avg_interval)

            history: list[DividendPayment] = [
                DividendPayment(date=ts.date().isoformat(), amount=round(float(v), 4))
                for ts, v in reversed(list(divs.iloc[-4:].items()))
            ]

            result = (future, history)
            with self._lock:
                self._div_cache[ticker] = result
            return result
        except Exception:
            return ([], [])

    def get_dividends(self, ticker: str) -> list[date]:
        return self._fetch_div_data(ticker)[0]

    def get_dividend_history(self, ticker: str) -> list[DividendPayment]:
        return self._fetch_div_data(ticker)[1]

    # ------------------------------------------------------------------
    # Option expirations
    # ------------------------------------------------------------------

    def get_option_expirations(self, ticker: str) -> list[str]:
        with self._lock:
            if ticker in self._exp_cache:
                return self._exp_cache[ticker]

        try:
            expirations = list(yf.Ticker(ticker).options)
            with self._lock:
                self._exp_cache[ticker] = expirations
            return expirations
        except Exception:
            return []

    # ------------------------------------------------------------------
    # Option chain (calls only)
    # ------------------------------------------------------------------

    def get_option_chain(self, ticker: str, expiry: str) -> list[OptionRow]:
        key = (ticker, expiry)
        with self._lock:
            if key in self._chain_cache:
                return self._chain_cache[key]

        try:
            calls = yf.Ticker(ticker).option_chain(expiry).calls
            rows: list[OptionRow] = [
                OptionRow(
                    strike=float(row["strike"]),
                    bid=float(row.get("bid") or 0),
                    ask=float(row.get("ask") or 0),
                    last=float(row.get("lastPrice") or 0),
                )
                for _, row in calls.iterrows()
            ]
            with self._lock:
                self._chain_cache[key] = rows
            return rows
        except Exception:
            return []
