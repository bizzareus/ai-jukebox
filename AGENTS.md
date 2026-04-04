# AGENTS.md

## Cursor Cloud specific instructions

### Overview

MuzoBox is a SaaS jukebox PWA for bars/venues. The repo is a monorepo with:

- **Backend** (`backend/`): NestJS 11 + TypeORM + PostgreSQL on port 3001
- **Frontend** (`frontend/`): React 19 + Vite 7 + Tailwind CSS 4 on port 5173

### Environment gotcha: NODE_ENV

The VM ships with `NODE_ENV=production`. You **must** override it when installing or running dev commands:

```bash
export NODE_ENV=development
```

Without this, `npm install` silently skips all `devDependencies` (including `concurrently`, `husky`, `eslint`, `typescript`, `vite`, `jest`, etc.) and reports "up to date" with 0 packages.

### PostgreSQL

PostgreSQL 16 is required. Start it before running the backend:

```bash
sudo pg_ctlcluster 16 main start
```

Database: `jukebox`, user: `jukebox`, password: `jukebox_secret` (matching `backend/.env`).

To initialize/reset the schema, run `init-db.sql` followed by all migration scripts in `backend/scripts/`:

```bash
PGPASSWORD=jukebox_secret psql -h localhost -U jukebox -d jukebox -f backend/scripts/init-db.sql
```

Then run migration scripts (`add-push-subscriptions.sql`, `add-gtm-leads.sql`, `add-gtm-whatsapp.sql`, `add-razorpay-order-id.sql`, `add-razorpay-qr.sql`, `add-customer-mobile.sql`, `add-venue-discount.sql`, `add-global-playlist-and-super-admin.sql`, `add-gtm-whatsapp-onboard.sql`, `add-gtm-leads-created-by.sql`, `add-gtm-leads-linkedin-message.sql`). TypeORM `synchronize` is **off**, so schema must match entities.

### Running services

Standard commands per `package.json`:

| Command | What it does |
|---|---|
| `npm run dev` (root) | Starts backend + frontend via `concurrently` |
| `npm run dev:backend` (root) | Backend only (`nest start --watch`, port 3001) |
| `npm run dev:frontend` (root) | Frontend only (`vite`, port 5173) |
| `npm run lint` (root) | Lint both backend and frontend |
| `npm run build` (root) | Build frontend (`tsc -b && vite build`) |
| `npm test` (backend/) | Run Jest unit tests |

### Backend .env

A `.env` file in `backend/` is required. Copy from `backend/.env.example` and fill in local dev values. Key required vars: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `FRONTEND_URL`. External API keys (Razorpay, YouTube, OpenAI) are optional — the app boots without them but related features won't work.

### Seeded test accounts

| Email | Password | Role |
|---|---|---|
| `superadmin@jukebox.local` | `password` | Super admin |
| `admin@jukebox.local` | `password123` | Venue admin (Sample Bar) |

### Husky hooks

- **pre-commit**: runs `npm run lint`
- **pre-push**: runs `npm run build` (frontend build must succeed)

The root `prepare` script calls `husky`. Since `NODE_ENV=production` skips devDeps, install with `--ignore-scripts` first, then run `npx husky install`.

### Frontend Vite proxy

In dev mode, Vite proxies `/api` and `/queue` (WebSocket) to `http://localhost:3001`. No `VITE_API_URL` env var is needed for local dev.
