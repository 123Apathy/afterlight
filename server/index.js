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
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

const PORT = process.env.PORT || 4400;
app.listen(PORT, () => {
  console.log(`Afterlight local server (Supabase-backed) listening on http://localhost:${PORT}`);
});
