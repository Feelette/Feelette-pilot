const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all members of a group with their received time (this week)
// GET /api/groups/:code/members?viewer_id=<id>
router.get('/:code/members', async (req, res) => {
  const { code } = req.params;
  const { viewer_id } = req.query;

  try {
    // Get all users in group
    const users = await db.query(
      'SELECT * FROM users WHERE group_code = $1 ORDER BY created_at',
      [code]
    );

    // Get received time (this week) for each user
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const gifts = await db.query(
      `SELECT to_user_id, SUM(seconds_given)::int as total_received
       FROM time_gifts
       WHERE group_code = $1 AND created_at >= $2
       GROUP BY to_user_id`,
      [code, weekStart.toISOString()]
    );

    const receivedMap = {};
    gifts.rows.forEach(g => {
      receivedMap[g.to_user_id] = g.total_received;
    });

    // Attach received totals, exclude viewer from members list
    const members = users.rows
      .filter(u => !viewer_id || u.id !== viewer_id)
      .map(u => ({
        id: u.id,
        name: u.name,
        code: u.code,
        color: u.color,
        group_type: u.group_type,
        current_value: u.current_value,
        last_state_update: u.last_state_update,
        received_this_week: receivedMap[u.id] || 0,
      }));

    res.json({ members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
