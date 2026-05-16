import time
from io import StringIO
from typing import TypedDict

import pandas as pd
import requests

CACHE_TTL_SECONDS = 86400  # 24 hours — index constituents change at most a few times per quarter

_caches: dict[str, tuple[list, float]] = {}  # index_id -> (companies, timestamp)

SOURCES: dict[str, str] = {
    "sp500": "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
    "nasdaq100": "https://en.wikipedia.org/wiki/Nasdaq-100",
    "dji": "https://en.wikipedia.org/wiki/Dow_Jones_Industrial_Average",
}


class IndexCompany(TypedDict):
    ticker: str
    name: str
    sector: str
    sub_industry: str


def _fetch_sp500() -> list[IndexCompany]:
    url = SOURCES["sp500"]
    response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
    response.raise_for_status()
    table = pd.read_html(StringIO(response.text), attrs={"id": "constituents"})[0]

    companies: list[IndexCompany] = []
    for _, row in table.iterrows():
        # Wikipedia uses dots (BRK.B, BF.B) — yfinance expects dashes (BRK-B, BF-B)
        ticker = str(row["Symbol"]).replace(".", "-")
        companies.append(
            IndexCompany(
                ticker=ticker,
                name=str(row["Security"]),
                sector=str(row["GICS Sector"]),
                sub_industry=str(row["GICS Sub-Industry"]),
            )
        )
    return companies


def _fetch_nasdaq100() -> list[IndexCompany]:
    url = SOURCES["nasdaq100"]
    response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
    response.raise_for_status()
    table = pd.read_html(StringIO(response.text), attrs={"id": "constituents"})[0]

    companies: list[IndexCompany] = []
    for _, row in table.iterrows():
        ticker = str(row["Ticker"]).replace(".", "-")
        companies.append(
            IndexCompany(
                ticker=ticker,
                name=str(row["Company"]),
                sector=str(row.get("GICS Sector", "")),
                sub_industry=str(row.get("GICS Sub-Industry", "")),
            )
        )
    return companies


def _fetch_dji() -> list[IndexCompany]:
    url = SOURCES["dji"]
    response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
    response.raise_for_status()
    tables = pd.read_html(StringIO(response.text))
    # The DJI components table has "Symbol" and "Company" columns with ~30 rows
    table = next(
        (t for t in tables if "Symbol" in t.columns and "Company" in t.columns and len(t) >= 28),
        None,
    )
    if table is None:
        raise RuntimeError("Could not locate DJI components table on Wikipedia")

    companies: list[IndexCompany] = []
    for _, row in table.iterrows():
        ticker = str(row["Symbol"]).replace(".", "-")
        industry = str(row["Industry"]) if "Industry" in row.index else ""
        companies.append(
            IndexCompany(
                ticker=ticker,
                name=str(row["Company"]),
                sector=industry,
                sub_industry="",
            )
        )
    return companies


_FETCHERS = {
    "sp500": _fetch_sp500,
    "nasdaq100": _fetch_nasdaq100,
    "dji": _fetch_dji,
}

SUPPORTED_INDICES = list(_FETCHERS.keys())


def get_universe(index: str = "sp500") -> list[IndexCompany]:
    """Return the constituent list for the given index, cached for 24 hours.

    Supported indices: sp500, nasdaq100, dji
    Adding a new index only requires adding a fetcher to _FETCHERS and a URL to SOURCES.
    """
    if index not in _FETCHERS:
        raise ValueError(f"Unsupported index '{index}'. Choose from: {SUPPORTED_INDICES}")

    cached = _caches.get(index)
    if cached and (time.time() - cached[1]) < CACHE_TTL_SECONDS:
        return cached[0]

    companies = _FETCHERS[index]()
    _caches[index] = (companies, time.time())
    return companies


def get_merged_universe(indices: list[str]) -> list[IndexCompany]:
    """Return a deduplicated company list across multiple indices.

    Ticker collision is resolved by keeping the first occurrence (index order preserved).
    """
    seen: set[str] = set()
    merged: list[IndexCompany] = []
    for index in indices:
        for company in get_universe(index):
            if company["ticker"] not in seen:
                seen.add(company["ticker"])
                merged.append(company)
    return merged
