# Paza Monorepo (Turborepo)

High-performance Turborepo monorepo for **Paza**, a modern full-stack web application for discovering, bookmarking, and RSVPing to events in Addis Ababa.

---

## Architecture & Workspaces

```
paza/
├── .github/
│   └── workflows/
│       └── deploy.yml        # Root CI/CD pipeline (Turbo lint/build + Docker images build/push + EC2 deploy)
├── backend/                  # FastAPI backend server, REST API, and automated ingestion pipeline
│   ├── app/                  # REST endpoints, database models, schemas, and AI services
│   ├── Dockerfile            # Python 3.11 container specification
│   ├── requirements.txt      # Python dependencies
│   ├── package.json          # Backend workspace scripts for Turborepo
│   └── schema.sql            # PostgreSQL database schema
├── frontend/                 # Web App client (React 19 + TypeScript + Vite + Tailwind CSS)
│   ├── src/                  # React components, pages, hooks, and API clients
│   ├── Dockerfile            # Multi-stage production container (Node 20 builder + Nginx runner)
│   ├── nginx.conf            # Nginx SPA router and backend API proxy
│   └── package.json          # Frontend workspace dependencies & scripts
├── docker-compose.yml        # Root app orchestration (FE & BE standalone containers)
├── turbo.json                # Turborepo pipeline configuration
└── package.json              # Monorepo root workspaces & scripts
```

---

## Turborepo Commands

All tasks are unified and accelerated via Turborepo caching:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Run both **Backend** and **Frontend** concurrently with multiplexed logs |
| `npm run build` | Cache-accelerated build across all workspaces |
| `npm run lint` | Run code validation across backend and frontend |
| `npm run test` | Run test suites across workspaces |
| `npm run dev:frontend` | Run frontend development server only (`vite`) |
| `npm run dev:backend` | Run backend development server only (`uvicorn`) |
| `npm run build:frontend` | Build frontend production bundle |
| `npm run lint:frontend` | Lint frontend codebase |

---

## Docker Orchestration

The root `docker-compose.yml` orchestrates the application containers (**Backend** and **Frontend**) without bundling database/cache servers inside docker:

```bash
# Build and start both Frontend and Backend application containers
docker compose up -d --build

# View real-time logs
docker compose logs -f

# Stop containers
docker compose down
```

* **Frontend Container**: Exposed on `http://localhost:3000` (Nginx serving production bundle with SPA fallback and `/api/` proxying).
* **Backend Container**: Exposed on `http://localhost:8000` (FastAPI with OpenAPI docs at `/docs`).

> **Note**: Database (PostgreSQL) and Cache (Redis) are managed externally (e.g., managed cloud instances, RDS, or system services) and configured via environment variables in `backend/.env`.

---

## Root CI/CD Pipeline

The GitHub Actions workflow is located at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

1. **Lint & Build Stage (`ci`)**: Runs Turborepo linting (`npx turbo lint`) and build (`npx turbo build`) with caching.
2. **Container Image Build & Push Stage (`build-and-push`)**: Matrix job that builds and pushes separate production Docker images to GitHub Container Registry (GHCR):
   * Backend Image: `ghcr.io/<org>/<repo>-backend:latest`
   * Frontend Image: `ghcr.io/<org>/<repo>-frontend:latest`
3. **Deployment Stage (`deploy`)**: Connects to the host server, transfers runtime configuration securely, pulls the latest container images from GHCR, and starts the orchestrated containers with `docker compose`.
