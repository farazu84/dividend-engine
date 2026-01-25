# ModernFi Liquidity Management

A full-stack treasury yield management application that allows users to view real-time treasury yield curves, place orders on treasury instruments, and track order history.

## Features

- **Treasury Yield Curve**: Real-time yield curve visualization powered by FRED API data
- **Benchmark Instruments**: Customizable watchlist of treasury instruments with 7-day performance tracking
- **Order Placement**: Submit market or limit orders for treasury instruments
- **Order History**: View and filter historical order submissions

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- React Router
- Lightweight Charts (for yield curve visualization)

### Backend
- FastAPI (Python)
- SQLAlchemy + SQLite
- FRED API integration

## Getting Started

### Prerequisites
- Node.js 20.19+ or 22.12+
- Python 3.11+
- [uv](https://github.com/astral-sh/uv) (Python package manager)

### Backend Setup

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Create a `.env` file with your FRED API key:
   ```
   FRED_API_KEY=your_api_key_here
   ```
   
   You can get a free API key at: https://fred.stlouisfed.org/docs/api/api_key.html

3. Install dependencies and run the server:
   ```bash
   uv sync
   uv run uvicorn app.main:app --reload --port 8000
   ```

   The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the platform directory:
   ```bash
   cd platform
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`

## Database

The application uses **SQLite** for data persistence. The database file (`modernfi.db`) is automatically created in the `server/` directory when the backend starts.


**Orders**
| Column | Type | Description |
|--------|------|-------------|
| id | Integer | Primary key |
| series_id | String | Treasury series (e.g., "DGS10") |
| term | String | Maturity term (e.g., "10Y") |
| amount | Float | Order amount in USD |
| yield_rate | Float | Yield at time of order |
| status | String | "filled", "pending", or "cancelled" |
| ordered_at | DateTime | Order submission timestamp |
