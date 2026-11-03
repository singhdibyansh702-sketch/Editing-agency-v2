const db = require('../db');

function generateId(prefix = 'msg') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
}

// ==========================================
// GET CONVERSATIONS
// ==========================================

async function getConversations(req, res, next) {
  try {
    const user = req.user;

    if (user.role === 'ADMIN') {
      // Admin sees two tabs: "clients" and "editors"
      // Fetch all clients with latest message & unread count
      const [clients] = await db.query(`
        SELECT 
          u.id, u.name, u.email, u.role, cp.company_name,
          (
            SELECT message FROM direct_messages 
            WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id)
            ORDER BY created_at DESC LIMIT 1
          ) AS last_message,
          (
            SELECT created_at FROM direct_messages 
            WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id)
            ORDER BY created_at DESC LIMIT 1
          ) AS last_message_time,
          (
            SELECT COUNT(*) FROM direct_messages 
            WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0
          ) AS unread_count
        FROM users u
        LEFT JOIN client_profiles cp ON u.id = cp.user_id
        WHERE u.role = 'CLIENT' AND u.status = 'ACTIVE'
        ORDER BY last_message_time DESC NULLS LAST, u.name ASC
      `, [user.id, user.id, user.id, user.id, user.id]);

      // Fetch all editors with latest message & unread count
      const [editors] = await db.query(`
        SELECT 
          u.id, u.name, u.email, u.role, ep.skills,
          (
            SELECT message FROM direct_messages 
            WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id)
            ORDER BY created_at DESC LIMIT 1
          ) AS last_message,
          (
            SELECT created_at FROM direct_messages 
            WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id)
            ORDER BY created_at DESC LIMIT 1
          ) AS last_message_time,
          (
            SELECT COUNT(*) FROM direct_messages 
            WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0
          ) AS unread_count
        FROM users u
        LEFT JOIN editor_profiles ep ON u.id = ep.user_id
        WHERE u.role = 'EDITOR' AND u.status = 'ACTIVE'
        ORDER BY last_message_time DESC NULLS LAST, u.name ASC
      `, [user.id, user.id, user.id, user.id, user.id]);

      return res.json({
        success: true,
        conversations: {
          clients,
          editors
        }
      });
    }

    // Client or Editor: Can ONLY chat with Admin
    const [admins] = await db.query('SELECT id, name, email, role FROM users WHERE role = "ADMIN" LIMIT 1');
    const admin = admins[0];

    if (!admin) {
      return res.json({ success: true, conversations: [] });
    }

    const [unread] = await db.query(
      'SELECT COUNT(*) as count FROM direct_messages WHERE sender_id = ? AND receiver_id = ? AND is_read = 0',
      [admin.id, user.id]
    );

    const [lastMsg] = await db.query(
      'SELECT message, created_at FROM direct_messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY created_at DESC LIMIT 1',
      [user.id, admin.id, admin.id, user.id]
    );

    res.json({
      success: true,
      conversations: [
        {
          id: admin.id,
          name: 'Agency Support & Admin',
          role: 'ADMIN',
          last_message: lastMsg[0] ? lastMsg[0].message : 'Direct agency coordination',
          last_message_time: lastMsg[0] ? lastMsg[0].created_at : null,
          unread_count: unread[0] ? (unread[0].count || unread[0]['COUNT(*)']) : 0
        }
      ]
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// GET MESSAGE THREAD
// ==========================================

async function getMessages(req, res, next) {
  try {
    const user = req.user;
    const { otherUserId } = req.params;

    // Verify target user
    const [targetUsers] = await db.query('SELECT id, name, role FROM users WHERE id = ?', [otherUserId]);
    if (!targetUsers || targetUsers.length === 0) {
      return res.status(404).json({ success: false, message: 'Recipient not found.' });
    }
    const target = targetUsers[0];

    // STRICT PRIVACY BOUNDARY CHECK
    if (user.role === 'CLIENT' && target.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Clients can only communicate directly with Agency Admin.'
      });
    }

    if (user.role === 'EDITOR' && target.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Editors can only communicate directly with Agency Admin.'
      });
    }

    // Fetch conversation messages
    const [messages] = await db.query(`
      SELECT 
        dm.*,
        su.name AS sender_name,
        su.role AS sender_role,
        ru.name AS receiver_name,
        ru.role AS receiver_role,
        p.project_code,
        p.title AS project_title
      FROM direct_messages dm
      JOIN users su ON dm.sender_id = su.id
      JOIN users ru ON dm.receiver_id = ru.id
      LEFT JOIN projects p ON dm.project_id = p.id
      WHERE (dm.sender_id = ? AND dm.receiver_id = ?) 
         OR (dm.sender_id = ? AND dm.receiver_id = ?)
      ORDER BY dm.created_at ASC
    `, [user.id, otherUserId, otherUserId, user.id]);

    // Mark received messages as read
    await db.query(
      'UPDATE direct_messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0',
      [otherUserId, user.id]
    );

    res.json({
      success: true,
      recipient: {
        id: target.id,
        name: user.role === 'ADMIN' ? target.name : 'Agency Support & Admin',
        role: target.role
      },
      messages
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// SEND MESSAGE
// ==========================================

async function sendMessage(req, res, next) {
  try {
    const user = req.user;
    const { receiver_id, message, project_id } = req.body;

    if (!receiver_id || !message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Receiver ID and message content are required.' });
    }

    const [targets] = await db.query('SELECT id, name, role FROM users WHERE id = ?', [receiver_id]);
    if (!targets || targets.length === 0) {
      return res.status(404).json({ success: false, message: 'Recipient not found.' });
    }
    const target = targets[0];

    // STRICT PRIVACY CHECK (BACKEND ENFORCEMENT)
    if (user.role === 'CLIENT' && target.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Direct communication between Client and Editor is strictly blocked.'
      });
    }

    if (user.role === 'EDITOR' && target.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Direct communication between Editor and Client is strictly blocked.'
      });
    }

    const messageId = generateId('msg');

    await db.query(
      `INSERT INTO direct_messages (id, sender_id, receiver_id, project_id, message, is_read)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [messageId, user.id, receiver_id, project_id || null, message.trim()]
    );

    // Create notification for recipient
    await db.query(
      'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
      [
        generateId('ntf'),
        receiver_id,
        `New Message from ${user.role === 'ADMIN' ? 'Agency Admin' : user.name}`,
        message.trim().slice(0, 100),
        '/#chat',
        'MESSAGE'
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Message delivered',
      direct_message: {
        id: messageId,
        sender_id: user.id,
        sender_name: user.name,
        sender_role: user.role,
        receiver_id,
        project_id,
        message: message.trim(),
        created_at: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getConversations,
  getMessages,
  sendMessage
};

