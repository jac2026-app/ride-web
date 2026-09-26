// server.js
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const rideRoutes = require('./routes/rides');

const app = express();
const PORT = process.env.PORT || 3000;

// Allow your site's domain to call this API. Update ALLOWED_ORIGIN in .env
// once you know the domain the frontend will be hosted on.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// Basic protection against form spam/abuse — 20 submissions per 15 min per IP.
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' }
});

app.use('/api/register', formLimiter);
app.use('/api/login', formLimiter);
app.use('/api/rides', formLimiter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running.' });
});

app.use('/api', authRoutes);
app.use('/api/rides', rideRoutes);

// Local testing only: serve the website at http://localhost:PORT/ so it can
// be tested through a real URL instead of file:///. Turn on with
// SERVE_FRONTEND=true in .env. Only the files listed here are served — never
// the whole project folder, which also contains server/.env.
if (process.env.SERVE_FRONTEND === 'true') {
  const FRONTEND_FILES = { '/': 'index.html', '/robots.txt': 'robots.txt', '/sitemap.xml': 'sitemap.xml' };
  for (const [route, file] of Object.entries(FRONTEND_FILES)) {
    app.get(route, (req, res) => res.sendFile(path.join(__dirname, '..', 'public', file)));
  }
}

// Fallback 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'Not found.' });
});

app.listen(PORT, () => {
  console.log(`Rideweb API listening on http://localhost:${PORT}`);
});
