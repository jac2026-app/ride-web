// notify.js
// Sends the owner an email for every new ride request, so bookings don't sit
// unseen in the database. Uses a Gmail App Password (see .env.example) — never
// your real Gmail password. If the settings are missing, notifications are
// skipped and the booking still saves normally.

const nodemailer = require('nodemailer');

const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || GMAIL_USER;

const transporter = (GMAIL_USER && GMAIL_APP_PASSWORD)
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
    })
  : null;

if (!transporter) {
  console.warn('Email notifications are off: set GMAIL_USER and GMAIL_APP_PASSWORD in .env to turn them on.');
}

// Customer input goes into the email subject, so strip line breaks to stop
// anyone from sneaking extra email headers in.
function oneLine(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function formatRide(ride) {
  const carSeat = ride.carSeat ? `${ride.carSeat.count} x ${ride.carSeat.type}` : 'None';
  return [
    'New ride request',
    '',
    `Confirmation #: ${ride.id}`,
    `Customer:       ${oneLine(ride.name)}`,
    `Phone:          ${oneLine(ride.phone)}`,
    '',
    `Pickup:         ${oneLine(ride.pickup)}`,
    `Drop-off:       ${oneLine(ride.dropoff)}`,
    `Date / time:    ${oneLine(ride.date)} at ${oneLine(ride.time)}`,
    `Vehicle:        ${oneLine(ride.vehicle)}`,
    `Passengers:     ${oneLine(ride.passengers)}`,
    `Car seat:       ${carSeat}`,
    '',
    `Received:       ${ride.createdAt}`,
    '',
    'Call or text the customer to confirm.'
  ].join('\n');
}

async function notifyNewRide(ride) {
  if (!transporter) return;
  await transporter.sendMail({
    from: `"Ride Requests" <${GMAIL_USER}>`,
    to: NOTIFY_EMAIL,
    subject: oneLine(`New ride: ${ride.date} ${ride.time} - ${ride.pickup} to ${ride.dropoff}`).slice(0, 150),
    text: formatRide(ride) // plain text only, so customer input can't inject HTML
  });
}

module.exports = { notifyNewRide };
