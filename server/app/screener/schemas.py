from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ExProbability(str, Enum):
    very_high = "Very High"
    high = "High"
    medium = "Medium"
    low = "Low"
    very_low = "Very Low"
    na = "N/A"


# ---------------------------------------------------------------------------
# Screener
# ---------------------------------------------------------------------------

class ScreenedStockResponse(BaseModel):
    ticker: str
    name: str
    sector: str
    price: float
    week52_high: float
    drawdown_pct: float = Field(..., description="Fraction below 52-week high, e.g. 0.34 = 34%")
    div_yield: float = Field(..., description="Dividend yield as decimal, e.g. 0.07 = 7%")
    div_per_quarter: float = Field(..., description="Quarterly dividend per share in USD")
    payout_ratio: float = Field(..., description="Payout ratio as decimal, e.g. 0.59 = 59%")
    market_cap: Optional[float] = None
    pe_ratio: Optional[float] = None
    price_history: list[float] = Field(default_factory=list, description="~40 downsampled close prices over 1 year")


class ScreenerResponse(BaseModel):
    stocks: list[ScreenedStockResponse]
    total: int
    cached: bool


class ScreenerResultsResponse(BaseModel):
    """Screener-only response (no options data). Used by GET /screener."""
    indices: list[str]
    total: int
    cached: bool
    results: list[ScreenedStockResponse]


# ---------------------------------------------------------------------------
# Options analysis
# ---------------------------------------------------------------------------

class DividendPaymentResponse(BaseModel):
    date: str = Field(..., description="Ex-dividend date YYYY-MM-DD")
    amount: float = Field(..., description="Dividend amount per share in USD")


class OptionStrikeResponse(BaseModel):
    strike: float
    premium: float = Field(..., description="Mid-price (bid+ask)/2 or last price")
    expiry: str = Field(..., description="Option expiry date YYYY-MM-DD")
    days_to_expiry: int
    protection: float = Field(..., description="Downside protection as decimal, e.g. 0.15 = 15%")
    call_value: float = Field(..., description="Strike + premium — total value received at exercise")
    investment_per_100: float = Field(..., description="Net cash outlay for 100 shares after premium collected")
    num_dividends: int = Field(..., description="Ex-dividend dates falling on or before expiry")
    roi_year: float = Field(..., description="Annualised ROI holding to expiry")
    early_exercise_date: Optional[str] = Field(None, description="Projected date call buyer may exercise early, YYYY-MM-DD")
    num_div_early_ex: int = Field(..., description="Dividends collected before projected early exercise")
    days_to_early_ex: Optional[int] = None
    roi_year_early_ex: Optional[float] = Field(None, description="Annualised ROI if call buyer exercises early")
    ex_probability: ExProbability = Field(..., description="Likelihood of early exercise based on time value vs dividend")


class TickerOptionsResponse(BaseModel):
    ticker: str
    name: str
    price: float
    div_per_quarter: float
    next_ex_div_date: Optional[str] = Field(None, description="Next ex-dividend date YYYY-MM-DD")
    future_ex_div_dates: list[str] = Field(default_factory=list, description="Projected future ex-dividend dates YYYY-MM-DD")
    recent_dividends: list[DividendPaymentResponse] = Field(default_factory=list)
    strikes: list[OptionStrikeResponse]
    total_strikes: int


# ---------------------------------------------------------------------------
# Combined: screener stock + its options (full pipeline response)
# ---------------------------------------------------------------------------

class ScreenedStockWithOptionsResponse(BaseModel):
    # Screener fields
    ticker: str
    name: str
    sector: str
    price: float
    week52_high: float
    drawdown_pct: float
    div_yield: float
    div_per_quarter: float
    payout_ratio: float
    market_cap: Optional[float] = None
    pe_ratio: Optional[float] = None
    price_history: list[float] = Field(default_factory=list)
    # Options fields
    next_ex_div_date: Optional[str] = None
    strikes: list[OptionStrikeResponse] = []
    total_strikes: int = 0


class FullScreenerResponse(BaseModel):
    indices: list[str]
    total: int
    cached: bool
    results: list[ScreenedStockWithOptionsResponse]
