# Wind Forecast Desk

Wind Forecast Desk is a decision-support dashboard for evaluating UK national wind generation forecasts for January 2026. It compares Elexon BMRS WINDFOR forecasts available at a configurable day-ahead decision cutoff with FUELHH actual wind generation.

## Features

- Visualizes actual and forecast wind generation across January 2026.
- Selects the latest eligible forecast vintage published at or before the configured day-ahead decision cutoff.
- Avoids look-ahead bias by excluding forecasts published after the decision cutoff.
- Reports Mean Absolute Error (MAE), Root Mean Squared Error (RMSE), forecast bias, Weighted Absolute Percentage Error (WAPE), and data coverage.
- Identifies matched intervals, missing eligible forecasts, and forecast-resolution gaps.
- Allows users to inspect forecast publication vintages for an hourly delivery target.
- Provides data-quality information to help interpret forecast accuracy.

## Technology Stack

- **Frontend:** React, TypeScript, TanStack Start, Tailwind CSS, Recharts
- **Backend:** Python, FastAPI, Uvicorn
- **Frontend testing:** Vitest
- **Backend testing:** pytest
- **Containerization:** Docker and Docker Compose
- **Data source:** Elexon BMRS datasets

## Project Structure

```text
wind-desk-audit/
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
│   │   └── wind/
│   ├── routes/
│   ├── test/
│   ├── router.tsx
│   ├── routeTree.gen.ts
│   ├── server.ts
│   ├── start.ts
│   └── styles.css
├── .dockerignore
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── eslint.config.js
├── package.json
├── package-lock.json
├── tsconfig.json
├── vercel.json
├── vite.config.ts
└── vitest.config.ts
```

The frontend source code and root Dockerfile are located in the project root. The `backend/` directory contains the FastAPI service, its data snapshots, and backend tests.

## Data Sources

### Actual Wind Generation

FUELHH dataset documentation:

https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream

### Wind Generation Forecasts

WINDFOR dataset documentation:

https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream

The application uses bundled January 2026 snapshots sourced from Elexon BMRS. It does not fetch live data on every page load.

WINDFOR forecasts have hourly target resolution, while FUELHH actual generation data is half-hourly. The application identifies forecast-resolution gaps rather than interpolating forecast values that are not present in the source data.

## Forecast Methodology

For each delivery date, the decision cutoff is the configured local time on the preceding calendar day in the `Europe/London` time zone.

For each hourly target, the backend selects the most recently published forecast available at or before the decision cutoff. Forecasts published after the cutoff are excluded from the evaluation to avoid look-ahead bias.

Forecast error is calculated as:

**Forecast error = Forecast generation - Actual generation**

The dashboard reports the following metrics:

- **MAE:** Mean Absolute Error measures the average absolute difference between forecasts and actual generation.
- **RMSE:** Root Mean Squared Error gives greater weight to larger forecast errors.
- **Bias:** Average signed forecast error indicates directional over-forecasting or under-forecasting.
- **WAPE:** Weighted Absolute Percentage Error expresses total absolute error relative to total actual generation.
- **Coverage:** Indicates how much of the expected evaluation data is available and matched.

Missing eligible forecast vintages and differences in dataset resolution affect coverage. Missing forecasts are identified rather than treated as valid observations.

These metrics support forecast evaluation and procurement judgement. They do not independently determine the optimal electricity purchase.

## Run with Docker

### Prerequisites

- Docker Desktop
- Docker Compose
- Git

### Start the Application

Clone the repository and navigate to its root directory:

```bash
git clone https://github.com/HarshalMahajan-3/wind-forecast-desk.git
cd wind-desk-audit
```

Replace the repository URL with the actual public GitHub repository URL.

Build and start the frontend and backend:

```bash
docker compose up --build
```

Alternatively, start the application in the background:

```bash
docker compose up -d --build
```

### Application URLs

Once the services have started, open:

- **Dashboard:** http://localhost:3000
- **FastAPI documentation:** http://localhost:8000/docs
- **Backend health check:** http://localhost:8000/health

### Stop the Application

If running in the foreground, press `Ctrl+C`. Then run:

```bash
docker compose down
```

If the application was started in the background, run:

```bash
docker compose down
```

This stops and removes the Compose containers and network. It does not delete the project source files.

## Run Locally Without Docker

### Prerequisites

- Node.js 22 or compatible
- Python 3.12 or compatible

### 1. Start the Backend

From the project root, open Git Bash and run:

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The backend runs at:

http://localhost:8000

### 2. Start the Frontend

Open a second terminal at the project root and run:

```bash
npm install
npm run dev
```

The development server will display the local frontend URL in the terminal.

By default, the frontend uses `http://localhost:8000` for browser-side API requests. Configure `VITE_API_BASE_URL` when using a different backend URL.

## Testing

### Frontend Tests

Run from the project root:

```bash
npm test
```

### Backend Tests

Run from the project root:

```bash
cd backend
python -m pytest -q
```

The backend test suite was verified inside Docker, with all six tests passing. The frontend test suite previously passed all 17 tests during local verification.

## Docker Architecture

The project uses two services managed by Docker Compose.

**Frontend service**
- Built from the root Dockerfile.
- Runs the React and TanStack Start application.
- Exposes port 3000.
- Uses `VITE_API_BASE_URL` for browser-side API requests.
- Uses `API_INTERNAL_BASE_URL` for server-side requests inside Docker.

**Backend service**
- Built from `backend/Dockerfile`.
- Runs the FastAPI application using Uvicorn.
- Exposes port 8000.
- Provides a health-check endpoint.
- Serves analysis and forecast-vintage API requests using bundled datasets.

Inside Docker, the frontend uses `http://backend:8000` to communicate with the backend service. The browser uses `http://localhost:8000` for local API requests.

## Deployment

Complete these links after deploying and verifying the application.

- **Live Dashboard:** [Add deployed frontend URL]
- **Backend API:** [Add deployed backend URL]
- **Public GitHub Repository:** [Add repository URL]
- **Demo Video:** [Add unlisted YouTube URL]

For separate frontend and backend hosting:

1. Deploy the FastAPI backend and verify its health endpoint and API documentation.
2. Set `VITE_API_BASE_URL` to the public backend URL when building the frontend.
3. Configure the backend's `CORS_ORIGINS` environment variable to include the exact deployed frontend origin.
4. Deploy the TanStack Start frontend using a compatible hosting configuration.
5. Test the dashboard, analysis endpoint, and forecast-vintage functionality using the public URLs.
6. Verify all links in an incognito browser window before submitting the assignment.

## AI Tool Disclosure

Lovable was used to scaffold the initial interface. ChatGPT assisted with code review, Python API development, Docker integration, and documentation. The implementation and tests should be reviewed before deployment and submission.

## Limitations

- The application uses a fixed January 2026 data snapshot rather than continuously fetching live Elexon data.
- The analysis covers national wind generation only.
- Consumer-demand and wholesale electricity price data are not included.
- WINDFOR forecasts and FUELHH actuals have different time resolutions.
- Forecast accuracy and coverage support decision-making but do not calculate an optimal electricity purchase or provide a live market recommendation.