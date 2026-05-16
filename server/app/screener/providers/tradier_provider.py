import os
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

import httpx
import pandas as pd
import yfinance as yf
from cachetools import TTLCache

from .base import DividendPayment, OptionRow, TickerFundamentals

_SANDBOX_BASE = "https://sandbox.tradier.com/v1"
_PROD_BASE = "https://api.tradier.com/v1"

_4H = 4 * 3600
_1H = 3600


class TradierProvider:
    """Uses Tradier for live quotes and options chains.

    Tradier does not expose dividend/payout fundamentals, so those fields
    are supplemented via yfinance. Swap this out for another source once
    a fuller fundamentals feed is wired up.
    """

    def __init__(self) -> None:
        token = os.environ.get("TRADIER_API_TOKEN", "")
        if not token:
            raise RuntimeError("TRADIER_API_TOKEN env var is required for the Tradier provider")

        sandbox = os.environ.get("TRADIER_SANDBOX", "true").lower() != "false"
        self._base = _SANDBOX_BASE if sandbox else _PROD_BASE
        self._client = httpx.Client(
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            timeout=10,
        )

        self._price_cache: TTLCache = TTLCache(maxsize=5, ttl=_4H)
        self._fund_cache: TTLCache = TTLCache(maxsize=600, ttl=_4H)
        self._div_cache: TTLCache = TTLCache(maxsize=600, ttl=_4H)
        self._exp_cache: TTLCache = TTLCache(maxsize=200, ttl=_1H)
        self._chain_cache: TTLCache = TTLCache(maxsize=2000, ttl=_1H)
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get(self, path: str, params: dict) -> dict:
        r = self._client.get(f"{self._base}{path}", params=params)
        r.raise_for_status()
        return r.json()

    # ------------------------------------------------------------------
    # Price history  (per-ticker parallel fetch — Tradier has no batch endpoint)
    # ------------------------------------------------------------------

    def get_price_history(self, tickers: list[str], period: str = "1y") -> pd.DataFrame:
        key = (tuple(sorted(tickers)), period)
        with self._lock:
            if key in self._price_cache:
                return self._price_cache[key]

        end = date.today()
        start = end - timedelta(days=365)

        def _fetch_one(ticker: str) -> tuple[str, pd.Series | None]:
            try:
                data = self._get("/markets/history", {
                    "symbol": ticker,
                    "interval": "daily",
                    "start": start.isoformat(),
                    "end": end.isoformat(),
                })
                days = data.get("history") or {}
                rows = days.get("day", [])
                if not rows:
                    return ticker, None
                series = pd.Series(
                    {d["date"]: float(d["close"]) for d in rows},
                    name=ticker,
                )
                series.index = pd.to_datetime(series.index)
                return ticker, series
            except Exception:
                return ticker, None

        with ThreadPoolExecutor(max_workers=20) as ex:
            results = dict(ex.map(_fetch_one, tickers))

        valid = {t: s for t, s in results.items() if s is not None}
        df = pd.DataFrame(valid) if valid else pd.DataFrame()

        with self._lock:
            self._price_cache[key] = df
        return df

    # ------------------------------------------------------------------
    # Fundamentals  (Tradier quote for live price; yfinance for div fields)
    # ------------------------------------------------------------------

    def get_fundamentals(self, ticker: str) -> TickerFundamentals | None:
        with self._lock:
            if ticker in self._fund_cache:
                return self._fund_cache[ticker]

        try:
            data = self._get("/markets/quotes", {"symbols": ticker, "greeks": "false"})
            raw_quote = (data.get("quotes") or {}).get("quote")
            if not raw_quote:
                return None
            q = raw_quote if isinstance(raw_quote, dict) else raw_quote[0]

            price = float(q.get("last") or q.get("prevclose") or 0)
            if price <= 0:
                return None

            # yfinance for dividend / payout fundamentals
            info = yf.Ticker(ticker).info
            div_yield = (info.get("dividendYield") or 0.0) / 100
            annual_div = float(info.get("trailingAnnualDividendRate") or 0.0)
            payout_ratio = float(info.get("payoutRatio") or 0.0)
            pe_raw = info.get("trailingPE") or info.get("forwardPE") or None

            result = TickerFundamentals(
                name=info.get("longName") or info.get("shortName") or q.get("description") or ticker,
                sector=info.get("sector") or "",
                price=price,
                annual_div=annual_div,
                div_yield=div_yield,
                payout_ratio=payout_ratio,
                market_cap=info.get("marketCap") or None,
                pe_ratio=round(pe_raw, 1) if pe_raw else None,
                ex_div_date=info.get("exDividendDate"),
            )
            with self._lock:
                self._fund_cache[ticker] = result
            return result
        except Exception:
            return None

    # ------------------------------------------------------------------
    # Dividend schedule  (Tradier has no dividend endpoint; use yfinance)
    # ------------------------------------------------------------------

    def _fetch_div_data(self, ticker: str) -> tuple[list[date], list[DividendPayment]]:
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
            data = self._get("/markets/options/expirations", {
                "symbol": ticker,
                "includeAllRoots": "true",
            })
            raw = (data.get("expirations") or {}).get("date", [])
            expirations: list[str] = [raw] if isinstance(raw, str) else list(raw)
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
            data = self._get("/markets/options/chains", {
                "symbol": ticker,
                "expiration": expiry,
                "greeks": "false",
            })
            raw = (data.get("options") or {}).get("option", [])
            options = [raw] if isinstance(raw, dict) else list(raw)

            rows: list[OptionRow] = [
                OptionRow(
                    strike=float(o["strike"]),
                    bid=float(o.get("bid") or 0),
                    ask=float(o.get("ask") or 0),
                    last=float(o.get("last") or 0),
                )
                for o in options
                if o.get("option_type") == "call"
            ]
            with self._lock:
                self._chain_cache[key] = rows
            return rows
        except Exception:
            return []
