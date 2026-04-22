const express = require('express');
const router = express.Router();
const db = require('../db');

// Get favorites for a user (returns favorite_user_ids array, newest first)
// GET /api/favorites/:user_id
router.get('/:user_id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT favorite_user_id, created_at
       FROM favorites
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.params.user_id]
    );
    res.json({ favorites: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add favorite
// POST /api/favorites
// body: { user_id, favorite_user_id }
router.post('/', async (req, res) => {
  const { user_id, favorite_user_id } = req.body;
  if (!user_id || !favorite_user_id) return res.status(400).json({ error: 'ids required' });
  if (user_id === favorite_user_id) return res.status(400).json({ error: 'cannot favorite yourself' });

  try {
    const result = await db.query(
      `INSERT INTO favorites (user_id, favorite_user_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, favorite_user_id) DO NOTHING
       RETURNING *`,
      [user_id, favorite_user_id]
    );
    res.json({ favorite: result.rows[0] || { already: true } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove favorite
// DELETE /api/favorites
// body: { user_id, favorite_user_id }
router.delete('/', async (req, res) => {
  const { user_id, favorite_user_id } = req.body;
  if (!user_id || !favorite_user_id) return res.status(400).json({ error: 'ids required' });

  try {
    await db.query(
      `DELETE FROM favorites WHERE user_id = $1 AND favorite_user_id = $2`,
      [user_id, favorite_user_id]
    );
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
