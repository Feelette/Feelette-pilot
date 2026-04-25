const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const usersRouter = require('./routes/users');
const groupsRouter = require('./routes/groups');
const giftsRouter = require('./routes/gifts');
const questionsRouter = require('./routes/questions');
const favoritesRouter = require('./routes/favorites');

// Database pool for scheduled tasks (nightly reset needs direct SQL access)
// Handle both export styles: module.exports = pool  OR  module.exports = { pool }
const dbModule = require('./db');
const pool = dbModule.pool || dbModule;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'feelette-pilot', version: '4.2', ts: new Date().toISOString() });
});

// API routes
app.use('/api/users', usersRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/gifts', giftsRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/favorites', favoritesRouter);

// ============================================================
// DAILY GIFT RESET — runs every night at 04:00 Finnish time
// ============================================================
// Philosophy: time given is a *present moment* — it fades as the day rolls
// over. What matters today isn't carried forward forever as an accumulation.
// We keep the History records intact (so people can look back later), but
// the visible "seconds received" on friend balls resets.
//
// Implementation: we delete gifts older than 20 hours. This creates a
// rolling window — a gift given just before 04:00 doesn't vanish in a
// minute; it lives about 20 hours before the next nightly sweep catches it.
// Rhythm matches the sleep cycle, not the clock.

async function runNightlyGiftReset() {
  const started = new Date();
  try {
    const result = await pool.query(`
      DELETE FROM time_gifts
      WHERE created_at < NOW() - INTERVAL '20 hours'
    `);
    const rowCount = result.rowCount || 0;
    console.log(`[${started.toISOString()}] 🌙 Nightly gift reset: removed ${rowCount} old gift records (>20h)`);
  } catch (err) {
    console.error(`[${started.toISOString()}] ❌ Nightly gift reset FAILED:`, err.message);
  }
}

// Schedule: 04:00 Finnish time (Europe/Helsinki) every day
cron.schedule('0 4 * * *', runNightlyGiftReset, {
  timezone: 'Europe/Helsinki',
});

console.log('⏰ Nightly gift reset scheduled for 04:00 Europe/Helsinki');

// Manual trigger endpoint — useful for testing or one-off cleanup
// Usage: curl -X POST https://feelette-pilot-production.up.railway.app/admin/reset-gifts
// IMPORTANT: This must be defined BEFORE the 404 handler below.
app.post('/admin/reset-gifts', async (req, res) => {
  try {
    await runNightlyGiftReset();
    res.json({ ok: true, message: 'Manual reset complete' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 404 handler — must be the LAST app.use() before error handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Feelette Pilot v4.2 running on port ${PORT}`);
});
