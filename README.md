# Wind Forecast Desk

Wind Forecast Desk is a decision-support dashboard for evaluating UK national wind generation forecasts for January 2026. It compares Elexon BMRS WINDFOR forecasts available at a configurable day-ahead decision cutoff with FUELHH actual wind generation.

The application helps users evaluate forecast accuracy, identify data-quality gaps, and understand the information available when making day-ahead electricity procurement decisions.

## Features

- Visualizes actual and forecast wind generation across January 2026.
- Selects the latest eligible forecast vintage published at or before the configured day-ahead decision cutoff.
- Excludes forecasts published after the decision cutoff to avoid look-ahead bias.
- Reports Mean Absolute Error (MAE), Root Mean Squared Error (RMSE), forecast bias, Weighted Absolute Percentage Error (WAPE), and data coverage.
- Identifies matched intervals, missing eligible forecasts, and forecast-resolution gaps.
- Allows users to inspect forecast publication vintages for an hourly delivery target.
- Displays data-quality information to help interpret forecast accuracy.

## Technology Stack

- **Frontend:** React, TypeScript, TanStack Start, Tailwind CSS, Recharts
- **Backend:** Python, FastAPI, Uvicorn
- **Frontend testing:** Vitest
- **Backend testing:** pytest
- **Containerization:** Docker and Docker Compose
- **Data source:** Elexon BMRS datasets
- **Frontend hosting:** Vercel
- **Backend hosting:** Render

## Project Structure

```text
wind-forecast-desk/
├── backend/
│   ├── data/
│   │   ├── actuals-jan2026.json
│   │   └── forecasts-jan2026.json
│   ├── tests/
│   │   └── test_api.py
│   ├── Dockerfile
│   ├── main.py
│   └── requirements.txt
├── public/
│   ├── favicon.svg
│   └── robots.txt
├── src/
│   ├── components/
│   │   ├── ui/
│   │   └── wind/
│   ├── hooks/
│   ├── lib/
│   │   ├── wind/
│   │   │   ├── analysis.ts
│   │   │   ├── format.ts
│   │   │   ├── functions.ts
│   │   │   ├── queries.ts
│   │   │   └── time.ts
│   │   ├── error-capture.ts
│   │   ├── error-page.ts
│   │   └── utils.ts
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── index.tsx
│   │   └── README.md
│   ├── test/
│   │   ├── app-routing.test.tsx
│   │   ├── setup.ts
│   │   └── wind-analysis.test.ts
│   ├── router.tsx
│   ├── routeTree.gen.ts
│   ├── server.ts
│   ├── start.ts
│   └── styles.css
├── .dockerignore
├── .env.example
├── .gitignore
├── .prettierignore
├── .prettierrc
├── components.json
├── Dockerfile
├── docker-compose.yml
├── eslint.config.js
├── package.json
├── package-lock.json
├── README.md
├── tsconfig.json
├── vercel.json
├── vite.config.ts
└── vitest.config.ts
```

The frontend source code and production Dockerfile are located in the repository root. The `backend/` directory contains the FastAPI service, bundled data snapshots, backend tests, and its own Dockerfile.

## Data Sources

### Actual Wind Generation: FUELHH

FUELHH provides actual generation data.

Documentation:  
https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream

### Wind Generation Forecasts: WINDFOR

WINDFOR provides wind generation forecasts.

Documentation:  
https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream

The application uses bundled January 2026 snapshots sourced from Elexon BMRS. It does not fetch live data on every page load.

WINDFOR forecasts have hourly target resolution, while FUELHH actual generation data is half-hourly. The application identifies forecast-resolution gaps rather than interpolating forecast values that are not present in the source data.

## Forecast Methodology

For each delivery date, the decision cutoff is the configured local time on the preceding calendar day in the `Europe/London` time zone.

For each hourly target, the backend selects the most recently published eligible forecast available at or before the decision cutoff. Forecasts published after the cutoff are excluded from the evaluation to avoid look-ahead bias.

Forecast error is calculated as:

**Forecast error = Forecast generation − Actual generation**

The dashboard reports the following metrics:

- **MAE (Mean Absolute Error):** Measures the average absolute difference between forecast and actual generation.
- **RMSE (Root Mean Squared Error):** Measures forecast error magnitude while giving greater weight to larger errors.
- **Bias:** Average signed forecast error. Positive bias indicates over-forecasting, while negative bias indicates under-forecasting.
- **WAPE (Weighted Absolute Percentage Error):** Expresses total absolute forecast error relative to total actual generation.
- **Coverage:** Reports data availability and matched observations separately from forecast accuracy.

Missing eligible forecast vintages and differences in dataset resolution affect coverage. Missing forecasts are identified rather than treated as valid observations.

These metrics support forecast evaluation and procurement judgement. They do not independently determine the optimal electricity purchase.

## Run with Docker

### Prerequisites

- Git
- Docker Desktop
- Docker Compose

### 1. Clone the Repository

Open a terminal and run:

```bash
git clone https://github.com/HarshalMahajan-3/wind-forecast-desk.git
cd wind-forecast-desk
```

### 2. Build and Start the Application

Run from the repository root:

```bash
docker compose up --build
```

To run the services in the background:

```bash
docker compose up -d --build
```

Docker Compose builds and starts both services and configures their internal network connection.

### 3. Open the Application

Once the services are running, open:

- **Dashboard:** http://localhost:3000
- **FastAPI documentation:** http://localhost:8000/docs
- **Backend health check:** http://localhost:8000/health

The health endpoint should return a successful response when the backend is running.

### 4. Stop the Application

If running in the foreground, press `Ctrl+C`.

Then run:

```bash
docker compose down
```

This stops and removes the Compose containers and network. It does not delete the source code or project files.

## Run Locally Without Docker

### Prerequisites

- Node.js 22 or compatible
- Python 3.12 or compatible

### 1. Start the Backend

From the repository root, open Git Bash and run:

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The backend runs locally at:

http://localhost:8000

For macOS or Linux, activate the virtual environment with:

```bash
source .venv/bin/activate
```

### 2. Start the Frontend

Open a second terminal at the repository root and run:

```bash
npm install
npm run dev
```

The development server displays the frontend URL in the terminal.

The browser-facing API defaults to `http://localhost:8000`. If the backend runs at a different address, configure `VITE_API_BASE_URL` before starting or building the frontend.

The `.env.example` file documents the default local API URL. It does not need to be renamed to `.env` for the default local setup.

## Testing

### Frontend Tests

Run from the repository root:

```bash
npm test
```

The frontend test suite covers analysis logic and application routing.

### Backend Tests

Run from the repository root:

```bash
cd backend
python -m pytest -q
```

The backend test suite covers the FastAPI endpoints and forecast-analysis behavior.

During local verification, all 17 frontend tests and all 6 backend tests passed. The backend test run reported a Starlette deprecation warning related to the test client; the warning did not cause any tests to fail.

## Docker Architecture

The application uses two services managed by Docker Compose.

### Frontend

- Built from the root `Dockerfile`.
- Uses React, TypeScript, and TanStack Start.
- Exposes port `3000`.
- Uses `VITE_API_BASE_URL` for browser-facing API requests.
- Uses `API_INTERNAL_BASE_URL` for server-side API requests inside Docker.

### Backend

- Built from `backend/Dockerfile`.
- Runs FastAPI using Uvicorn.
- Exposes port `8000`.
- Provides a health-check endpoint.
- Serves analysis and forecast-vintage API requests using bundled data snapshots.

Inside Docker, the frontend communicates with the backend using:

`http://backend:8000`

The browser accesses the local backend using:

`http://localhost:8000`

These addresses serve different purposes: `backend` is the Docker service hostname, while `localhost` refers to the user's computer when accessed through the browser.

## Deployment

The application is deployed with the frontend on Vercel and the FastAPI backend on Render.

- **Live Dashboard:** https://wind-forecast-desk.vercel.app/
- **Backend API:** https://wind-forecast-desk.onrender.com
- **API Documentation:** https://wind-forecast-desk.onrender.com/docs
- **Backend Health Check:** https://wind-forecast-desk.onrender.com/health
- **Public GitHub Repository:** https://github.com/HarshalMahajan-3/wind-forecast-desk

### Backend Configuration

The backend runs using FastAPI and Uvicorn. The health endpoint and API documentation are available through the deployed backend URL.

### Frontend Configuration

The frontend is deployed to Vercel using the TanStack Start configuration included in the repository.

The `VITE_API_BASE_URL` environment variable points the frontend to the public backend URL. The backend's `CORS_ORIGINS` configuration should include the exact deployed frontend origin.

The `API_INTERNAL_BASE_URL` value of `http://backend:8000` is intended for communication between services in local Docker Compose. It is not the public backend URL.

Before submission, verify that the dashboard, analysis endpoint, and forecast-vintage functionality work using the public URLs. Test the links in an incognito browser window.

## AI Tool Disclosure

Lovable was used to scaffold the initial interface. ChatGPT assisted with code review, Python API development, Docker integration, and documentation. The implementation and tests should be reviewed before deployment and submission.

## Limitations

- The application uses fixed January 2026 data snapshots rather than fetching live Elexon data on every page load.
- The analysis focuses on UK national wind generation.
- Consumer-demand series and wholesale electricity price data are not included.
- WINDFOR forecasts and FUELHH actuals have different time resolutions.
- Missing eligible forecasts can affect data coverage and the number of matched observations.
- Forecast accuracy supports procurement judgement but does not calculate an optimal electricity purchase or provide a live market recommendation.