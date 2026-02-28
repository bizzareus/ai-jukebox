# Database scripts

## Setup (already done)

Tables and sample data were created with:

```bash
createdb jukebox   # if needed
psql -d jukebox -f scripts/init-db.sql
```

A PostgreSQL user `jukebox` with password `jukebox_secret` was also created so the backend can connect using the default `.env`.

## Sample login

| Field    | Value                 |
|----------|-----------------------|
| **Email**    | `admin@jukebox.local` |
| **Password** | `password123`         |

Use these at **http://localhost:5173/admin/login** after starting the backend and frontend.

## Sample data

- **Venue:** `sample-bar` — "Sample Bar & Grill" (₹100/song, UPI: samplebar@okaxis)
- **Playlists:** "Classic Hits", "Party Mix" (each has 3 sample songs)
- **Songs:** Never Gonna Give You Up, Gangnam Style, Despacito (with YouTube IDs for embed)

Customer app URL for this venue: **http://localhost:5173/sample-bar**

## Migrations (existing DBs)

- **QR-only payments:** If you previously ran `add-razorpay-qr.sql`, drop the old order column:  
  `psql -d jukebox -f scripts/drop-razorpay-order-id.sql`

## Re-run seed only

To re-run seed inserts on a fresh DB (drops nothing):

```bash
psql -d jukebox -f scripts/init-db.sql
```

Inserts are guarded by `WHERE NOT EXISTS`, so they only run when tables are empty.
