const db = require('../db');

async function getAuditLogs(req, res, next) {
  try {
    const { action, limit = 50 } = req.query;

    let sql = `
      SELECT 
        a.*,
        u.name AS user_name,
        u.email AS user_email,
        u.role AS user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (action && action !== 'ALL') {
      sql += ' AND a.action = ?';
      params.push(action);
    }

    sql += ' ORDER BY a.created_at DESC LIMIT ?';
    params.push(parseInt(limit, 10) || 50);

    const [logs] = await db.query(sql, params);

    res.json({
      success: true,
      logs
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAuditLogs
};

