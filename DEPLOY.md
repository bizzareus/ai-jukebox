# Deploy Jukebox on Railway

## 1. New project from GitHub

- [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → `bizzareus/ai-jukebox`

## 2. Add PostgreSQL

- **Add Service** → **Database** → **PostgreSQL**
- Copy **`DATABASE_URL`** from the PostgreSQL service (Connect / Variables).

## 3. Backend service

- Use the existing service created from the repo (or add one and set **Root Directory** = `backend`).
- **Variables** (required):

  | Variable | Value |
  |----------|--------|
  | `DATABASE_URL` | *(from PostgreSQL service)* |
  | `JWT_SECRET` | Long random string |
  | `JWT_EXPIRES_IN` | `7d` |
  | `RAZORPAY_KEY_ID` | Your key |
  | `RAZORPAY_KEY_SECRET` | Your secret |
  | `RAZORPAY_WEBHOOK_SECRET` | Your webhook secret |
  | `YOUTUBE_API_KEY` | Your YouTube Data API key |
  | `FRONTEND_URL` | *(set after frontend is deployed; e.g. `https://your-frontend.up.railway.app`)* |

- **Settings** → **Networking** → **Generate Domain**. Note the backend URL (e.g. `https://xxx.up.railway.app`).

DB migrations (schema + super admin) run automatically on startup via `entrypoint.sh`.

## 4. Frontend service

- **Add Service** → **GitHub Repo** → same repo.
- **Settings** → **Root Directory** = `frontend`.
- **Variables**:

  | Variable | Value |
  |----------|--------|
  | `BACKEND_URL` | Backend Railway URL from step 3 (e.g. `https://xxx.up.railway.app`) |

- **Settings** → **Networking** → **Generate Domain**. Note the frontend URL.

## 5. CORS

- In the **backend** service variables, set `FRONTEND_URL` to the frontend Railway URL from step 4 (no trailing slash).

## 6. Razorpay webhook

- Razorpay Dashboard → Webhooks → URL: `https://<backend-domain>/api/payments/webhook`

## Super admin (after deploy)

- Login: `superadmin@jukebox.local` / `password` at `https://<frontend-domain>/admin/login`
