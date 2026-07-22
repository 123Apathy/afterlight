// Local/Cloud Run dev entry: mounts the shared Express app (server/app.js),
// adds the SPA fallback + error handler, and listens on PORT.
const path = require('path');
const { app, distDir } = require('./app');

app.get(/^\/(?!api\/).*/, (req, res, next) => {
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  // 4xx messages are ours (validation etc.) and safe to show; 5xx details are
  // raw Supabase/Postgres errors — log them, never send them to clients.
  const status = err.status || 500;
  res.status(status).json({ error: status < 500 ? err.message || 'Request failed' : 'Something went wrong on our side. Please try again.' });
});

const PORT = process.env.PORT || 4400;
app.listen(PORT, () => {
  console.log(`Everlit local server (Supabase-backed) listening on http://localhost:${PORT}`);
});
