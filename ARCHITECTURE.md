# Architecture

Austin Luxury SUV — a chauffeured-ride marketing site with a ride-request and
customer-registration form backed by a small API. Two independently deployed
parts, connected only over HTTP:

```
┌─────────────────────┐        fetch()        ┌──────────────────────────┐
│  public/index.html   │  ───────────────────▶ │   server/ (Express API)  │
│   static frontend     │   JSON over HTTPS      │                          │
│  (Firebase Hosting)   │ ◀───────────────────  │   server/data/db.json    │
└─────────────────────┘                        └──────────────────────────┘
```

There is no build step, bundler, or framework on either side — plain HTML/CSS/JS
on the frontend, plain Express on the backend.

## Frontend — `public/index.html`

Everything under `public/` is what Firebase Hosting publishes, and nothing
else — keep secrets and server code out of this folder. A single
self-contained HTML file (styles and script inline, no external JS
dependencies besides Google Fonts). Sections, top to bottom:

- **Header/nav** — sticky nav with mobile hamburger menu.
- **Hero** (`#home`) — headline, CTAs, inline SVG route graphic.
- **Fleet gallery** (`#fleet`) — vehicle cards that open a lightbox
  (`#fleetLightbox`). Photos are placeholders (`fleetData` array in the
  script) — swapping in real images means replacing the SVG/text placeholder
  markup with `<img>` tags.
- **Request a Ride** (`#request`) — `#rideForm`, posts to `POST /api/rides`.
  Includes an optional car-seat sub-form revealed by a checkbox.
- **Privacy & Trust** (`#privacy`) — static reassurance copy, no logic.
- **Contact** (`#contact`) — static phone/email/hours.
- **Register** (`#register`) — `#registerForm`, posts to `POST /api/register`.
- **Footer**.

SEO/meta: Open Graph, Twitter card, and `LimousineService` JSON-LD structured
data in `<head>`, plus `public/robots.txt` and `public/sitemap.xml` pointing at
`https://www.austinluxurysuv.com/`.

### Frontend ↔ backend wiring

Both forms are plain `fetch()` calls against a single constant near the
bottom of the inline `<script>`:

```js
const API_BASE = 'http://localhost:3000';
```

This must be changed to the deployed API's URL before going live — it's the
only coupling point between the two halves of the project. There's no env
templating; it's a literal string to hand-edit.

- `rideForm` submit → `POST {API_BASE}/api/rides` → shows `#rideSuccess` with
  the returned `confirmationId`, or an `alert()` on failure/network error.
- `registerForm` submit → checks password confirmation client-side, then
  `POST {API_BASE}/api/register` → shows `#regSuccess` or an `alert()`.

Both handlers disable their submit button and swap its label while the
request is in flight (`setSubmitting`).

## Backend — `server/`

Express app (CommonJS, no TypeScript, no build step).

```
server/
  server.js          entrypoint: middleware, rate limiting, route mounting
  db.js              file-backed JSON persistence
  notify.js          emails the owner about each new ride (nodemailer + Gmail)
  routes/
    auth.js          POST /api/register, POST /api/login
    rides.js          POST /api/rides, GET /api/rides, PATCH /api/rides/:id
  data/db.json        the "database" (gitignored, created on first run)
  .env.example        PORT, ALLOWED_ORIGIN, ADMIN_KEY, GMAIL_*, SERVE_FRONTEND
```

### Request pipeline (`server.js`)

1. `dotenv` loads `.env`.
2. `cors({ origin: ALLOWED_ORIGIN })` — defaults to `*`; should be locked to
   the real frontend domain in production.
3. `express.json()` body parsing.
4. `express-rate-limit` — 20 requests / 15 min / IP, applied specifically to
   `/api/register`, `/api/login`, `/api/rides`.
5. `GET /api/health` — liveness check.
6. Route mounts: `authRoutes` at `/api`, `rideRoutes` at `/api/rides`.
7. Local testing only: when `SERVE_FRONTEND=true`, serves the three files in
   `public/` at `http://localhost:3000/` (an explicit allow-list — never the
   whole project folder, which contains `server/.env`).
8. Catch-all `404` for unmatched `/api/*`.

### Notifications — `notify.js`

After a ride is saved, `notifyNewRide()` emails the details to `NOTIFY_EMAIL`
(defaults to `GMAIL_USER`) using a Gmail App Password from `.env`. It runs in
the background: an email failure is logged but never fails the booking. With
no `GMAIL_*` settings, notifications are skipped with a startup warning.
Emails are plain text and line breaks are stripped from the subject, so
customer input can't inject HTML or email headers.

### Persistence — `db.js`

No real database. `readDb()`/`writeDb()` synchronously read/write a single
JSON file (`server/data/db.json`, shape `{ users: [], rides: [] }`),
lazily created on first access. This is explicitly a placeholder — the
README notes swapping in Postgres/MySQL later without needing to change
route logic much (routes only touch `readDb`/`writeDb`, never the file
directly). Because writes are whole-file rewrites with no locking, this
does not tolerate concurrent writers or multiple server instances — fine
for a low-traffic single-process deployment, not for scaling out.

### Routes — `routes/auth.js`

- `POST /api/register` — validates required fields, email shape, password
  length (≥8) and confirmation match, and email uniqueness; hashes the
  password with `bcryptjs` (cost 10) before storing; returns the created
  user with `passwordHash` stripped.
- `POST /api/login` — looks up by email, `bcrypt.compare`s the password;
  returns the user with `passwordHash` stripped. **Note:** this issues no
  session or token — a successful login returns user data but the frontend
  has no corresponding login form or session handling, so nothing currently
  calls this endpoint.

### Routes — `routes/rides.js`

- `POST /api/rides` — public, rate-limited. Validates all required fields
  plus the optional `carSeat` object (`type` ∈ `Infant/Convertible/Booster`,
  `count` 1–4). Stores the ride with `status: 'pending'` and returns a
  `confirmationId`.
- `GET /api/rides` — dispatcher view, gated by `requireAdminKey` (an
  `x-api-key` header compared against `ADMIN_KEY` from `.env`). Returns all
  rides, newest first.
- `PATCH /api/rides/:id` — admin-only, updates `status` to one of
  `pending/confirmed/completed/cancelled`.

There is no admin UI for these dispatcher endpoints yet — they're consumed
via `curl` per `server/README.md`.

### IDs and auth model

- IDs (`user.id`, `ride.id`) are `Date.now().toString(36) + random suffix` —
  not cryptographically unique, but fine at this scale.
- The only auth boundary in the system is the single shared `ADMIN_KEY`
  bearer secret gating the two dispatcher endpoints. Customer accounts
  (`/api/register`, `/api/login`) exist but nothing currently depends on
  being logged in — the ride-request flow does not require or attach a
  user account.

## Deployment shape

- **Frontend**: any static host (the README calls out that typical shared
  cPanel hosting works fine here).
- **Backend**: needs a Node-capable host (Render/Railway/VPS) — explicitly
  *not* compatible with static-only hosting. `server/data/db.json` lives on
  local disk, so the backend host must provide persistent (not ephemeral)
  storage across deploys/restarts, and horizontal scaling is not supported
  as-is (see persistence note above).
- The two are stitched together purely by the `API_BASE` constant in
  `index.html` and the `ALLOWED_ORIGIN` CORS setting in `server/.env` — both
  must be updated together when the domains are finalized.

### Current deployment

- **Frontend**: Firebase Hosting, project `ride-web-6e097` (`firebase.json`,
  `.firebaserc`). Publishes `public/` only, with security headers
  (HSTS, `X-Frame-Options: DENY`, `nosniff`, referrer policy).
  - Preview: `firebase hosting:channel:deploy test --expires 7d`
  - Live: `firebase deploy --only hosting` → `https://ride-web-6e097.web.app`
  - The old GitHub Pages site served `index.html` from the repo root and
    stops working now that the file lives in `public/`.
- **Backend**: not hosted yet — runs locally with `npm start` in `server/`.
  Planned: Google Cloud Run, with secrets in Secret Manager and bookings in
  Firestore. `render.yaml` is left over from an earlier Render plan and is
  unused.
  - Cloud Run (like Render's free tier) has an ephemeral filesystem, so
    `server/data/db.json` must be replaced with Firestore before real
    bookings.
- `public/index.html`'s `API_BASE` and the server's `ALLOWED_ORIGIN` must be
  updated together once the API has a public URL.

## Known gaps / likely next steps

(Carried over from `server/README.md`, confirmed against the code.)

- Swap `db.json` for a real database before real traffic / multi-instance
  deployment.
- Owner gets an email per ride request; no SMS yet (would need a provider
  like Twilio plus US 10DLC / toll-free registration). Customers get no
  email — the ride form doesn't collect one.
- Phone number on the site is still the placeholder `(512) 704-4145`.
- The "privacy policy" link in the Privacy section points to `#`.
- No dispatcher dashboard UI — `GET/PATCH /api/rides` are API-only today.
- `/api/login` is implemented but unused by the frontend — either wire up a
  login flow and session/token handling, or treat it as not-yet-integrated.
- Fleet gallery photos are placeholders (`fleetData` in `public/index.html`) pending
  real vehicle images.
