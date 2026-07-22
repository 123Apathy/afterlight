// Lifts the shared Express app (server/app.js) into a Netlify Function via
// serverless-http, so /api/*, /health, /join/*, /admin/* all run here.
// Static assets (the Expo web export) are served directly by Netlify's CDN
// from the publish dir, not through this function.
const serverless = require('serverless-http');
const { app } = require('../../server/app');

app.use((err, req, res, next) => {
  console.error(err);
  // 4xx messages are ours (validation etc.) and safe to show; 5xx details are
  // raw Supabase/Postgres errors — log them, never send them to clients.
  const status = err.status || 500;
  res.status(status).json({ error: status < 500 ? err.message || 'Request failed' : 'Something went wrong on our side. Please try again.' });
});

exports.handler = serverless(app);
