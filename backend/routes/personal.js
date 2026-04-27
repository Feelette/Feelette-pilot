const express = require('express');
const router = express.Router();
const db = require('../db');

// =============================================================
// PERSONAL CONVERSATIONS
// =============================================================
// A personal conversation is a private thread between 2+ users.
// Each member has a ball position (value 0-100) that other members see.
// Time gifts within the conversation are tracked in time_gifts via conversation_id.

// -------------------------------------------------------------
// GET /api/personal/:user_id
// Returns all conversations where user_id is a member, with:
//   - conversation metadata
//   - list of members (id, name, color)
//   - current ball values for each member
// -------------------------------------------------------------
router.get('/:user_id', async (req, res) => {
  const { user_id } = req.params;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    // Conversations the user is a member of
    const convResult = await db.query(
      `SELECT pc.id, pc.name, pc.is_pinned, pc.created_by, pc.created_at, pc.group_code
       FROM personal_conversations pc
       JOIN personal_members pm ON pm.conversation_id = pc.id
       WHERE pm.user_id = $1
       ORDER BY pc.is_pinned DESC, pc.created_at DESC`,
      [user_id]
    );
    const conversations = convResult.rows;
    if (!conversations.length) {
      return res.json({ conversations: [] });
    }

    const convIds = conversations.map(c => c.id);

    // All members of these conversations (with user info)
    const memberResult = await db.query(
      `SELECT pm.conversation_id, pm.user_id, u.name, u.color, u.code
       FROM personal_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.conversation_id = ANY($1::uuid[])`,
      [convIds]
    );

    // All current ball values
    const valueResult = await db.query(
      `SELECT conversation_id, user_id, value, updated_at
       FROM personal_values
       WHERE conversation_id = ANY($1::uuid[])`,
      [convIds]
    );

    // Build value lookup per conversation per user
    const valuesByConv = {};
    valueResult.rows.forEach(v => {
      if (!valuesByConv[v.conversation_id]) valuesByConv[v.conversation_id] = {};
      valuesByConv[v.conversation_id][v.user_id] = {
        value: v.value,
        updated: new Date(v.updated_at).getTime(),
      };
    });

    // Build members list per conversation
    const membersByConv = {};
    memberResult.rows.forEach(m => {
      if (!membersByConv[m.conversation_id]) membersByConv[m.conversation_id] = [];
      membersByConv[m.conversation_id].push({
        id: m.user_id,
        name: m.name,
        color: m.color,
        code: m.code,
      });
    });

    // Compose response
    const enriched = conversations.map(c => ({
      id: c.id,
      name: c.name,
      pinned: c.is_pinned,
      createdBy: c.created_by,
      createdAt: new Date(c.created_at).getTime(),
      groupCode: c.group_code,
      members: membersByConv[c.id] || [],
      values: valuesByConv[c.id] || {},
    }));

    res.json({ conversations: enriched });
  } catch (err) {
    console.error('GET /api/personal error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// POST /api/personal
// Create a new personal conversation.
// body: { created_by, group_code, name?, is_pinned?, member_ids: [uuid, ...] }
// member_ids should INCLUDE the creator.
// -------------------------------------------------------------
router.post('/', async (req, res) => {
  const { created_by, group_code, name, is_pinned, member_ids } = req.body;

  if (!created_by) return res.status(400).json({ error: 'created_by required' });
  if (!group_code) return res.status(400).json({ error: 'group_code required' });
  if (!Array.isArray(member_ids) || member_ids.length < 1) {
    return res.status(400).json({ error: 'member_ids array required (at least the creator)' });
  }

  // Ensure creator is in member list
  const allMembers = Array.from(new Set([...member_ids, created_by]));

  try {
    // Insert conversation
    const convResult = await db.query(
      `INSERT INTO personal_conversations (created_by, group_code, name, is_pinned)
       VALUES ($1, $2, $3, COALESCE($4, FALSE))
       RETURNING id, name, is_pinned, created_by, created_at, group_code`,
      [created_by, group_code, name || null, is_pinned || false]
    );
    const conv = convResult.rows[0];

    // Insert members (one query, parameterized)
    const valuesPlaceholders = allMembers.map((_, i) => `($1, $${i + 2})`).join(', ');
    await db.query(
      `INSERT INTO personal_members (conversation_id, user_id)
       VALUES ${valuesPlaceholders}
       ON CONFLICT DO NOTHING`,
      [conv.id, ...allMembers]
    );

    // Initialize ball values to 50 for all members
    const valuesPlaceholders2 = allMembers.map((_, i) => `($1, $${i + 2}, 50)`).join(', ');
    await db.query(
      `INSERT INTO personal_values (conversation_id, user_id, value)
       VALUES ${valuesPlaceholders2}
       ON CONFLICT DO NOTHING`,
      [conv.id, ...allMembers]
    );

    res.json({ conversation: { ...conv, members: allMembers } });
  } catch (err) {
    console.error('POST /api/personal error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// PUT /api/personal/:conversation_id/value
// Update the ball value for a user in a conversation.
// body: { user_id, value }
// -------------------------------------------------------------
router.put('/:conversation_id/value', async (req, res) => {
  const { conversation_id } = req.params;
  const { user_id, value } = req.body;

  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  if (typeof value !== 'number' || value < 0 || value > 100) {
    return res.status(400).json({ error: 'value must be number 0-100' });
  }

  try {
    // Verify user is a member of this conversation
    const memberCheck = await db.query(
      `SELECT 1 FROM personal_members WHERE conversation_id = $1 AND user_id = $2`,
      [conversation_id, user_id]
    );
    if (!memberCheck.rows.length) {
      return res.status(403).json({ error: 'not a member of this conversation' });
    }

    await db.query(
      `INSERT INTO personal_values (conversation_id, user_id, value, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (conversation_id, user_id)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [conversation_id, user_id, Math.round(value)]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/personal/:id/value error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// POST /api/personal/:conversation_id/members
// Add a member to a conversation.
// body: { user_id }
// -------------------------------------------------------------
router.post('/:conversation_id/members', async (req, res) => {
  const { conversation_id } = req.params;
  const { user_id } = req.body;

  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    // Verify the conversation exists
    const convCheck = await db.query(
      `SELECT 1 FROM personal_conversations WHERE id = $1`,
      [conversation_id]
    );
    if (!convCheck.rows.length) {
      return res.status(404).json({ error: 'conversation not found' });
    }

    await db.query(
      `INSERT INTO personal_members (conversation_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [conversation_id, user_id]
    );

    // Initialize value for this new member
    await db.query(
      `INSERT INTO personal_values (conversation_id, user_id, value)
       VALUES ($1, $2, 50)
       ON CONFLICT DO NOTHING`,
      [conversation_id, user_id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/personal/:id/members error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// DELETE /api/personal/:conversation_id/members/:user_id
// Remove a member from a conversation.
// -------------------------------------------------------------
router.delete('/:conversation_id/members/:user_id', async (req, res) => {
  const { conversation_id, user_id } = req.params;

  try {
    await db.query(
      `DELETE FROM personal_members WHERE conversation_id = $1 AND user_id = $2`,
      [conversation_id, user_id]
    );
    await db.query(
      `DELETE FROM personal_values WHERE conversation_id = $1 AND user_id = $2`,
      [conversation_id, user_id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE member error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// DELETE /api/personal/:conversation_id
// Delete an entire conversation. Only the creator may delete.
// body: { user_id } — for authorization
// -------------------------------------------------------------
router.delete('/:conversation_id', async (req, res) => {
  const { conversation_id } = req.params;
  const { user_id } = req.body;

  if (!user_id) return res.status(400).json({ error: 'user_id required for authorization' });

  try {
    const check = await db.query(
      `SELECT created_by FROM personal_conversations WHERE id = $1`,
      [conversation_id]
    );
    if (!check.rows.length) {
      return res.status(404).json({ error: 'conversation not found' });
    }
    if (check.rows[0].created_by !== user_id) {
      return res.status(403).json({ error: 'only the creator may delete' });
    }

    // Cascade will handle members and values
    await db.query(
      `DELETE FROM personal_conversations WHERE id = $1`,
      [conversation_id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE conversation error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
