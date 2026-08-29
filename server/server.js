// server.js
require('dotenv').config();
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

// Fallback 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'Not found.' });
});

app.listen(PORT, () => {
  console.log(`Rideweb API listening on http://localhost:${PORT}`);
});
