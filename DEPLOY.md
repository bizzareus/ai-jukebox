# Deploy Jukebox on Railway

Railway does **not** support defining multiple services in one config file. This repo is set up so that:

- **Backend** is built from the **repo root** using `railway.json` + `Dockerfile.backend` (no Root Directory needed).
- **Frontend** requires a **second service** with **Root Directory** = `frontend`.

**If you see:** `Railpack could not determine how to build the app` → ensure the service is using the repo’s config (Config File path in Settings = `/railway.json` or leave default so the root `railway.json` is used). The root config forces Dockerfile build.

---

## 1. New project from GitHub

- [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → `bizzareus/ai-jukebox`
- The first service will use the root **`railway.json`** and **`Dockerfile.backend`** and build the backend. **Do not set Root Directory** for this service.

## 2. Add PostgreSQL

- **Add Service** → **Database** → **PostgreSQL**
- Copy **`DATABASE_URL`** from the PostgreSQL service (Connect / Variables).

## 3. Backend service

- Use the service created in step 1. Leave **Root Directory** empty so it uses the root **`railway.json`** and **`Dockerfile.backend`**.
- Optional: in **Settings → Config**, set Config File path to **`/railway.json`** if Railway didn’t pick it up.
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

- **Variables** (optional, for GTM onboarding emails via Resend):
  | Variable | Value |
  |----------|--------|
  | `RESEND_API_KEY` | API key from [resend.com](https://resend.com) → API Keys. Required for "Send onboarding email" on the GTM page. |
  | `GTM_FROM_EMAIL` | From address (e.g. `Jukebox <onboarding@muzobox.com>`). Default: `onboarding@resend.dev`. |
  | `GTM_REPLY_TO` | Reply-to address for onboarding emails (e.g. `support@muzobox.com`). |

- **Settings** → **Networking** → **Generate Domain**. Note the backend URL (e.g. `https://xxx.up.railway.app`).

DB migrations (schema + super admin) run automatically on startup via `entrypoint.sh`.

## 4. Frontend service

- **Add Service** → **GitHub Repo** → same repo (`bizzareus/ai-jukebox`).
- **Settings** → **Root Directory** → set to **`frontend`** (this service uses `frontend/Dockerfile`). Config file path can be **`/frontend/railway.json`**.
- **Variables** (both required for webhooks and API to work):

  | Variable | Value |
  |----------|--------|
  | `BACKEND_URL` | **Required.** Backend URL for nginx proxy (e.g. `https://your-backend.up.railway.app`). All requests to `muzobox.com/api/` and `/queue` are proxied here. If unset, nginx uses `http://localhost:3001` and you will see *Connection refused* for webhooks/API. |
  | `VITE_API_URL` | Backend URL (e.g. `https://ai-jukebox-backend-production.up.railway.app`) — **baked in at build time** so the frontend calls the backend directly. Set this if frontend and backend are on different domains (e.g. custom domain muzobox.com). After adding or changing it, **redeploy** to trigger a new build. |

- **Settings** → **Networking** → **Generate Domain**. Note the frontend URL.

## 5. CORS

- In the **backend** service variables, set `FRONTEND_URL` to the frontend Railway URL from step 4 (no trailing slash).

## 6. Razorpay webhook

- Razorpay Dashboard → Webhooks → URL: `https://<backend-domain>/api/payments/webhook`

## Super admin (after deploy)

- Login: `superadmin@jukebox.local` / `password` at `https://<frontend-domain>/admin/login`
