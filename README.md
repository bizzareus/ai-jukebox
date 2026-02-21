# Jukebox PWA SaaS

A multi-venue bar jukebox PWA. Customers scan a QR code, browse songs, pay ₹100 via UPI, and queue their song. Admins manage the queue and play songs via YouTube on their device.

## Quick Start

### Prerequisites
- Node 20+
- Docker & Docker Compose (for full stack)
- YouTube Data API v3 key
- Razorpay account (key ID + secret + webhook secret)

### Development

**Backend:**
```bash
cd backend
cp .env.example .env   # fill in your keys
npm install
npm run start:dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Production (Docker)
```bash
cp backend/.env.example backend/.env  # fill in your keys
docker-compose up -d
```

App will be available at http://localhost

## Environment Variables

See `backend/.env.example` for all required variables.

Key ones:
- `YOUTUBE_API_KEY` — Google Cloud Console → YouTube Data API v3
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — Razorpay Dashboard
- `RAZORPAY_WEBHOOK_SECRET` — Set in Razorpay Dashboard under Webhooks
- `JWT_SECRET` — Any long random string
- `FRONTEND_URL` — Your frontend URL (for QR code generation + CORS)

## Architecture

- **Backend**: NestJS + TypeORM + PostgreSQL
- **Frontend**: React + Vite + TailwindCSS (PWA)
- **Real-time**: Socket.io
- **Payments**: Razorpay (UPI QR + deep link)
- **Music**: YouTube Data API v3 (metadata) + YouTube IFrame API (playback)

## Routes

### Customer
- `/:venueSlug` — Browse collections
- `/:venueSlug/playlist/:id` — Playlist songs
- `/:venueSlug/song/:songId` — Song detail + Pay
- `/:venueSlug/queue` — Live queue with ETA

### Admin
- `/admin/login` — Sign in
- `/admin/dashboard` — Overview
- `/admin/dj` — DJ Mode (YouTube player + queue)
- `/admin/library` — Manage playlists & songs
- `/admin/analytics` — Day-wise history & earnings

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | — | Register admin |
| POST | /api/auth/login | — | Login |
| GET | /api/auth/me | JWT | Current admin |
| GET | /api/venues/:slug | — | Get venue by slug |
| POST | /api/venues | JWT | Create venue |
| GET | /api/venues/:id/playlists | — | List playlists |
| POST | /api/venues/:id/playlists | JWT | Create playlist |
| POST | /api/playlists/:id/songs | JWT | Add song (fetches YT metadata) |
| GET | /api/songs/search?q= | JWT | YouTube search proxy |
| POST | /api/payments/create-order | — | Create Razorpay order + UPI string |
| POST | /api/payments/webhook | — | Razorpay webhook |
| GET | /api/queue/:venueId | — | Get live queue with ETAs |
| POST | /api/queue/advance | JWT | Play next song |

## Socket.io Events

| Event (emit) | Payload | Description |
|---|---|---|
| `join:venue` | `{ venueId }` | Subscribe to venue updates |
| `join:order` | `{ orderId }` | Subscribe to payment confirmation |

| Event (listen) | Payload | Description |
|---|---|---|
| `queue:updated` | `{ queue }` | Full queue refresh |
| `queue:confirmed` | `{ queueItem, position, eta }` | Payment confirmed, song queued |
| `queue:now-playing` | `{ queueItem }` | Current song changed |
