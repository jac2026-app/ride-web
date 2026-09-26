# Rideweb Backend

A small Node.js/Express API for the Austin Luxury SUV website — handles the
"Request a Ride" form and the "Register" form from `index.html`.

See [`../ARCHITECTURE.md`](../ARCHITECTURE.md) for how this fits together
with the frontend.

Storage is a plain JSON file (`data/db.json`), so there's nothing extra to
install or configure to get started. You can swap it for a real database
later without changing how the frontend talks to the API.

## What it does

- `POST /api/rides` — saves a ride request submitted from the site
- `GET /api/rides` — lists all ride requests (dispatcher-only, requires the admin key)
- `PATCH /api/rides/:id` — updates a ride's status: pending / confirmed / completed / cancelled (admin-only)
- `POST /api/register` — creates a customer account (password is hashed, never stored in plain text)
- `POST /api/login` — verifies a customer's email + password
- `GET /api/health` — quick check that the server is up

## Setup

```bash
cd server
npm install
cp .env.example .env
```

Open `.env` and set:
- `ADMIN_KEY` — any long random string. This is the password you'll use to view ride requests.
- `ALLOWED_ORIGIN` — once your site has a real domain, set this to it (e.g. `https://austinluxurysuv.com`). Leave as `*` for local testing.

Then start it:

```bash
npm start
```

You should see: `Rideweb API listening on http://localhost:3000`

## Connecting the frontend

In `index.html`, near the bottom `<script>` tag, there's this line:

```js
const API_BASE = 'http://localhost:3000';
```

- While testing locally, leave it as-is and open `index.html` in a browser while the server is running.
- Once you deploy the backend somewhere (see below), change this to that URL, e.g. `https://api.austinluxurysuv.com`.

## Viewing ride requests as the dispatcher

```bash
curl https://your-api-url/api/rides -H "x-api-key: YOUR_ADMIN_KEY"
```

This returns all ride requests, newest first. You could also build a small
admin page later that calls this endpoint — happy to build that next if useful.

## Deploying this

The plan is **Google Cloud Run**, in the same Google project as the website
(Firebase Hosting, `ride-web-6e097`). Secrets (`ADMIN_KEY`,
`GMAIL_APP_PASSWORD`) go in Google Secret Manager, never in the code.

Cloud Run doesn't keep files between restarts, so `data/db.json` must be
replaced with a real database (Firestore) before taking real bookings.

## Next steps worth considering

- Swap the JSON file storage for Firestore before real traffic
- Add SMS notifications when a ride request comes in (email is done — see `notify.js`; SMS needs a provider like Twilio plus US carrier registration)
- Add a simple dispatcher dashboard page that calls `GET /api/rides` and lets you update ride status
