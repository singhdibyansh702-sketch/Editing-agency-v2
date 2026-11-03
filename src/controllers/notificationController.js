const db = require('../db');

async function getNotifications(req, res, next) {
  try {
    const user = req.user;
    const [notifications] = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30',
      [user.id]
    );

    const [unread] = await db.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [user.id]
    );

    res.json({
      success: true,
      unread_count: unread[0] ? (unread[0].count || unread[0]['COUNT(*)']) : 0,
      notifications
    });
  } catch (err) {
    next(err);
  }
}

async function markAsRead(req, res, next) {
  try {
    const user = req.user;
    const { id } = req.params;

    if (id === 'all') {
      await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [user.id]);
    } else {
      await db.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, user.id]);
    }

    res.json({
      success: true,
      message: 'Notification(s) marked as read'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getNotifications,
  markAsRead
};

