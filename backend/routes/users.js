const express = require('express');
const router = express.Router();
const db = require('../db');

// Register or login user
// POST /api/users/login
// body: { code, name, group_code, color?, group_type?, email? }
router.post('/login', async (req, res) => {
  const { code, name, group_code, color, group_type, email } = req.body;

  if (!code || !/^\d{3}$/.test(code)) {
    return res.status(400).json({ error: 'Code must be 3 digits' });
  }
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name required' });
  }
  if (!group_code || group_code.trim().length === 0) {
    return res.status(400).json({ error: 'Group code required' });
  }

  // Validate email if given
  const emailClean = email && email.trim().length > 0 ? email.trim() : null;
  if (emailClean && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  try {
    const existing = await db.query(
      'SELECT * FROM users WHERE code = $1 AND group_code = $2',
      [code, group_code]
    );

    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      const updated = await db.query(
        `UPDATE users SET
         name = COALESCE($1, name),
         color = COALESCE($2, color),
         group_type = COALESCE($3, group_type),
         email = COALESCE($4, email)
         WHERE id = $5 RETURNING *`,
        [name || null, color || null, group_type || null, emailClean, user.id]
      );
      return res.json({ user: updated.rows[0], isNew: false });
    }

    const inserted = await db.query(
      `INSERT INTO users (code, name, group_code, color, group_type, email)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [code, name.trim(), group_code, color || '#378ADD', group_type || 'family', emailClean]
    );
    res.json({ user: inserted.rows[0], isNew: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update current "how are you doing" value
router.post('/:id/state', async (req, res) => {
  const { id } = req.params;
  const { value } = req.body;

  if (typeof value !== 'number' || value < 0 || value > 100) {
    return res.status(400).json({ error: 'Value must be 0-100' });
  }

  try {
    const result = await db.query(
      `UPDATE users SET current_value = $1, last_state_update = NOW()
       WHERE id = $2 RETURNING *`,
      [Math.round(value), id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
