// Lifts the shared Express app (server/app.js) into a Netlify Function via
// serverless-http, so /api/*, /health, /join/*, /admin/* all run here.
// Static assets (the Expo web export) are served directly by Netlify's CDN
// from the publish dir, not through this function.
const serverless = require('serverless-http');
const { app } = require('../../server/app');

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

exports.handler = serverless(app);
