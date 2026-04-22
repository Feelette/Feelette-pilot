const express = require('express');
const router = express.Router();
const db = require('../db');

// List questions for a group — newest first
// GET /api/questions?group_code=pilot
router.get('/', async (req, res) => {
  const { group_code } = req.query;
  if (!group_code) return res.status(400).json({ error: 'group_code required' });

  try {
    const result = await db.query(
      `SELECT q.*, u.name as author_name, u.color as author_color,
       (SELECT COUNT(*) FROM question_answers WHERE question_id = q.id)::int as answer_count
       FROM questions q
       JOIN users u ON u.id = q.author_id
       WHERE q.group_code = $1
       ORDER BY q.created_at DESC
       LIMIT 100`,
      [group_code]
    );
    res.json({ questions: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Create a question
// POST /api/questions
// body: { author_id, text }
router.post('/', async (req, res) => {
  const { author_id, text } = req.body;

  if (!author_id) return res.status(400).json({ error: 'author_id required' });
  if (!text || text.trim().length === 0) return res.status(400).json({ error: 'text required' });
  if (text.length > 200) return res.status(400).json({ error: 'text too long (max 200)' });

  try {
    const userRes = await db.query('SELECT group_code FROM users WHERE id = $1', [author_id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'user not found' });
    const group_code = userRes.rows[0].group_code;

    const result = await db.query(
      `INSERT INTO questions (author_id, group_code, text)
       VALUES ($1, $2, $3) RETURNING *`,
      [author_id, group_code, text.trim()]
    );
    res.json({ question: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get a single question with all answers
// GET /api/questions/:id
router.get('/:id', async (req, res) => {
  try {
    const qRes = await db.query(
      `SELECT q.*, u.name as author_name, u.color as author_color
       FROM questions q JOIN users u ON u.id = q.author_id
       WHERE q.id = $1`,
      [req.params.id]
    );
    if (qRes.rows.length === 0) return res.status(404).json({ error: 'not found' });

    const aRes = await db.query(
      `SELECT qa.*, u.name as user_name, u.color as user_color
       FROM question_answers qa
       JOIN users u ON u.id = qa.user_id
       WHERE qa.question_id = $1
       ORDER BY qa.updated_at ASC`,
      [req.params.id]
    );

    res.json({ question: qRes.rows[0], answers: aRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit or update an answer
// POST /api/questions/:id/answer
// body: { user_id, value }
router.post('/:id/answer', async (req, res) => {
  const { user_id, value } = req.body;
  const question_id = req.params.id;

  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  if (typeof value !== 'number' || value < 0 || value > 100) {
    return res.status(400).json({ error: 'value must be 0-100' });
  }

  try {
    const result = await db.query(
      `INSERT INTO question_answers (question_id, user_id, value, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (question_id, user_id)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
       RETURNING *`,
      [question_id, user_id, Math.round(value)]
    );
    res.json({ answer: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a question (only by author)
// DELETE /api/questions/:id?author_id=<id>
router.delete('/:id', async (req, res) => {
  const { author_id } = req.query;
  if (!author_id) return res.status(400).json({ error: 'author_id required' });

  try {
    const result = await db.query(
      'DELETE FROM questions WHERE id = $1 AND author_id = $2 RETURNING id',
      [req.params.id, author_id]
    );
    if (result.rows.length === 0) return res.status(403).json({ error: 'not found or not owner' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
