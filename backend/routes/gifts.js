const express = require('express');
const router = express.Router();
const db = require('../db');

// Give time to another user
// POST /api/gifts
// body: { from_user_id, to_user_id, seconds_given }
router.post('/', async (req, res) => {
  const { from_user_id, to_user_id, seconds_given } = req.body;

  if (!from_user_id || !to_user_id) {
    return res.status(400).json({ error: 'from and to user ids required' });
  }
  if (from_user_id === to_user_id) {
    return res.status(400).json({ error: 'Cannot give time to yourself' });
  }
  if (typeof seconds_given !== 'number' || seconds_given < 0.3) {
    return res.status(400).json({ error: 'seconds_given must be >= 0.3' });
  }

  try {
    // Get group_code from from_user
    const userResult = await db.query('SELECT group_code FROM users WHERE id = $1', [from_user_id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'from_user not found' });
    }
    const group_code = userResult.rows[0].group_code;

    const inserted = await db.query(
      `INSERT INTO time_gifts (from_user_id, to_user_id, group_code, seconds_given)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [from_user_id, to_user_id, group_code, seconds_given]
    );

    res.json({ gift: inserted.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get recent gifts received by user (for notification polling)
// GET /api/gifts/received/:user_id?since=<iso>
router.get('/received/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const { since } = req.query;

  try {
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 60000);

    const result = await db.query(
      `SELECT g.*, u.name as from_name, u.color as from_color
       FROM time_gifts g
       JOIN users u ON u.id = g.from_user_id
       WHERE g.to_user_id = $1 AND g.created_at > $2
       ORDER BY g.created_at DESC
       LIMIT 20`,
      [user_id, sinceDate.toISOString()]
    );

    res.json({ gifts: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get this week's history (daily totals)
// GET /api/gifts/history/:user_id
router.get('/history/:user_id', async (req, res) => {
  const { user_id } = req.params;

  try {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    // Given per day
    const given = await db.query(
      `SELECT DATE(created_at) as day, SUM(seconds_given)::int as total
       FROM time_gifts
       WHERE from_user_id = $1 AND created_at >= $2
       GROUP BY DATE(created_at)
       ORDER BY day DESC`,
      [user_id, weekStart.toISOString()]
    );

    // Received per day
    const received = await db.query(
      `SELECT DATE(created_at) as day, SUM(seconds_given)::int as total
       FROM time_gifts
       WHERE to_user_id = $1 AND created_at >= $2
       GROUP BY DATE(created_at)
       ORDER BY day DESC`,
      [user_id, weekStart.toISOString()]
    );

    // Received by person (this week)
    const byPerson = await db.query(
      `SELECT u.name, u.color, SUM(g.seconds_given)::int as total
       FROM time_gifts g
       JOIN users u ON u.id = g.from_user_id
       WHERE g.to_user_id = $1 AND g.created_at >= $2
       GROUP BY u.name, u.color
       ORDER BY total DESC`,
      [user_id, weekStart.toISOString()]
    );

    res.json({
      given_by_day: given.rows,
      received_by_day: received.rows,
      received_by_person: byPerson.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
