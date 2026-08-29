// routes/rides.js
const express = require('express');
const { readDb, writeDb } = require('../db');

const router = express.Router();

function requireAdminKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }
  next();
}

// POST /api/rides  — customer submits a ride request
router.post('/', (req, res) => {
  try {
    const { pickup, dropoff, date, time, vehicle, passengers, name, phone, carSeat } = req.body;

    if (!pickup || !dropoff || !date || !time || !vehicle || !passengers || !name || !phone) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // carSeat is optional. When present, validate its shape so bad data
    // doesn't silently reach the dispatcher.
    let safeCarSeat = null;
    if (carSeat) {
      const allowedTypes = ['Infant', 'Convertible', 'Booster'];
      if (!allowedTypes.includes(carSeat.type)) {
        return res.status(400).json({ success: false, message: 'Invalid car seat type.' });
      }
      const count = parseInt(carSeat.count, 10);
      if (!count || count < 1 || count > 4) {
        return res.status(400).json({ success: false, message: 'Car seat count must be between 1 and 4.' });
      }
      safeCarSeat = { type: carSeat.type, count };
    }

    const db = readDb();
    const ride = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      pickup,
      dropoff,
      date,
      time,
      vehicle,
      passengers,
      name,
      phone,
      carSeat: safeCarSeat, // null, or { type: 'Infant'|'Convertible'|'Booster', count: number }
      status: 'pending', // pending -> confirmed -> completed / cancelled
      createdAt: new Date().toISOString()
    };

    db.rides.push(ride);
    writeDb(db);

    return res.status(201).json({
      success: true,
      message: 'Ride request received.',
      confirmationId: ride.id
    });
  } catch (err) {
    console.error('Ride request error:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/rides — dispatcher/admin view of all ride requests (requires x-api-key header)
router.get('/', requireAdminKey, (req, res) => {
  const db = readDb();
  const sorted = [...db.rides].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, rides: sorted });
});

// PATCH /api/rides/:id — dispatcher updates a ride's status (requires x-api-key header)
router.patch('/:id', requireAdminKey, (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: `Status must be one of: ${allowed.join(', ')}` });
  }

  const db = readDb();
  const ride = db.rides.find(r => r.id === req.params.id);
  if (!ride) {
    return res.status(404).json({ success: false, message: 'Ride not found.' });
  }

  ride.status = status;
  writeDb(db);
  res.json({ success: true, ride });
});

module.exports = router;
