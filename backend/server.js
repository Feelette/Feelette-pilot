const express = require('express');
const cors = require('cors');

const usersRouter = require('./routes/users');
const groupsRouter = require('./routes/groups');
const giftsRouter = require('./routes/gifts');
const questionsRouter = require('./routes/questions');
const favoritesRouter = require('./routes/favorites');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'feelette-pilot', version: '3', ts: new Date().toISOString() });
});

// API routes
app.use('/api/users', usersRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/gifts', giftsRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/favorites', favoritesRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Feelette Pilot v3 running on port ${PORT}`);
});
