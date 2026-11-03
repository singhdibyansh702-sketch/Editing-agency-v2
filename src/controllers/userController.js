const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { sanitizeUser } = require('../middleware/sanitizer');

function generateId(prefix = 'id') {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
}

// ==========================================
// CLIENT MANAGEMENT (ADMIN ONLY)
// ==========================================

async function getClients(req, res, next) {
  try {
    const [clients] = await db.query(`
      SELECT 
        u.id, u.email, u.name, u.role, u.status, u.created_at, u.updated_at,
        cp.phone, cp.company_name, cp.notes,
        COUNT(p.id) AS total_projects,
        SUM(CASE WHEN p.status = 'Completed' THEN 1 ELSE 0 END) AS completed_projects,
        SUM(CASE WHEN p.status NOT IN ('Completed', 'Cancelled') THEN 1 ELSE 0 END) AS active_projects
      FROM users u
      LEFT JOIN client_profiles cp ON u.id = cp.user_id
      LEFT JOIN projects p ON u.id = p.client_id
      WHERE u.role = 'CLIENT'
      GROUP BY u.id, u.email, u.name, u.role, u.status, u.created_at, u.updated_at, cp.phone, cp.company_name, cp.notes
      ORDER BY u.created_at DESC
    `);

    res.json({
      success: true,
      clients: clients.map(c => sanitizeUser(c, 'ADMIN'))
    });
  } catch (err) {
    next(err);
  }
}

async function getClientById(req, res, next) {
  try {
    const { id } = req.params;
    const [users] = await db.query(`
      SELECT 
        u.id, u.email, u.name, u.role, u.status, u.created_at,
        cp.phone, cp.company_name, cp.notes
      FROM users u
      LEFT JOIN client_profiles cp ON u.id = cp.user_id
      WHERE u.id = ? AND u.role = 'CLIENT'
      LIMIT 1
    `, [id]);

    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    // Client projects
    const [projects] = await db.query(`
      SELECT p.*, 
        COALESCE((SELECT SUM(amount) FROM payments WHERE project_id = p.id AND type = 'CLIENT_PAYMENT'), 0) AS client_paid_amount
      FROM projects p
      WHERE p.client_id = ?
      ORDER BY p.created_at DESC
    `, [id]);

    res.json({
      success: true,
      client: sanitizeUser(users[0], 'ADMIN'),
      projects
    });
  } catch (err) {
    next(err);
  }
}

async function createClient(req, res, next) {
  try {
    const { name, email, password, phone, company_name, notes } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing && existing.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = generateId('u-client');
    const profileId = generateId('cp');

    await db.query(
      'INSERT INTO users (id, email, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, email.toLowerCase().trim(), passwordHash, name.trim(), 'CLIENT', 'ACTIVE']
    );

    await db.query(
      'INSERT INTO client_profiles (id, user_id, phone, company_name, notes) VALUES (?, ?, ?, ?, ?)',
      [profileId, userId, phone || null, company_name || null, notes || null]
    );

    // Audit log
    await db.query(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [generateId('aud'), req.user.id, 'CLIENT_CREATED', 'USER', userId, `Created new client profile for ${name} (${email})`, req.ip || '127.0.0.1']
    );

    res.status(201).json({
      success: true,
      message: 'Client account created successfully.',
      client: {
        id: userId,
        name,
        email: email.toLowerCase().trim(),
        role: 'CLIENT',
        status: 'ACTIVE',
        phone,
        company_name,
        notes
      }
    });
  } catch (err) {
    next(err);
  }
}

async function updateClient(req, res, next) {
  try {
    const { id } = req.params;
    const { name, email, phone, company_name, notes, status, password } = req.body;

    const [existing] = await db.query('SELECT id, email FROM users WHERE id = ? AND role = "CLIENT"', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    if (email && email.toLowerCase().trim() !== existing[0].email) {
      const [emailCheck] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email.toLowerCase().trim(), id]);
      if (emailCheck && emailCheck.length > 0) {
        return res.status(409).json({ success: false, message: 'Email is already taken by another account.' });
      }
    }

    // Update users table
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await db.query(
        'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), password_hash = ?, status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, email ? email.toLowerCase().trim() : null, passwordHash, status, id]
      );
    } else {
      await db.query(
        'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, email ? email.toLowerCase().trim() : null, status, id]
      );
    }

    // Update profile
    await db.query(
      'UPDATE client_profiles SET phone = ?, company_name = ?, notes = ? WHERE user_id = ?',
      [phone, company_name, notes, id]
    );

    await db.query(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [generateId('aud'), req.user.id, 'CLIENT_UPDATED', 'USER', id, `Updated client profile ${id}`, req.ip || '127.0.0.1']
    );

    res.json({
      success: true,
      message: 'Client updated successfully.'
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// EDITOR MANAGEMENT (ADMIN ONLY)
// ==========================================

async function getEditors(req, res, next) {
  try {
    const [editors] = await db.query(`
      SELECT 
        u.id, u.email, u.name, u.role, u.status, u.created_at, u.updated_at,
        ep.phone, ep.skills, ep.experience, ep.portfolio_link, ep.payment_rate, ep.internal_notes,
        COUNT(p.id) AS total_assigned_projects,
        SUM(CASE WHEN p.status = 'Completed' THEN 1 ELSE 0 END) AS completed_projects,
        SUM(CASE WHEN p.status IN ('Assigned', 'In Progress', 'Submitted for Review', 'Revision Required') THEN 1 ELSE 0 END) AS active_projects,
        COALESCE(SUM(p.editor_payment), 0) AS total_agreed_payout,
        COALESCE((
          SELECT SUM(pmt.amount) 
          FROM payments pmt 
          JOIN projects prj ON pmt.project_id = prj.id 
          WHERE prj.editor_id = u.id AND pmt.type = 'EDITOR_PAYMENT'
        ), 0) AS total_paid_payout
      FROM users u
      LEFT JOIN editor_profiles ep ON u.id = ep.user_id
      LEFT JOIN projects p ON u.id = p.editor_id
      WHERE u.role = 'EDITOR'
      GROUP BY u.id, u.email, u.name, u.role, u.status, u.created_at, u.updated_at, ep.phone, ep.skills, ep.experience, ep.portfolio_link, ep.payment_rate, ep.internal_notes
      ORDER BY u.created_at DESC
    `);

    res.json({
      success: true,
      editors: editors.map(e => sanitizeUser(e, 'ADMIN'))
    });
  } catch (err) {
    next(err);
  }
}

async function getEditorById(req, res, next) {
  try {
    const { id } = req.params;
    const [users] = await db.query(`
      SELECT 
        u.id, u.email, u.name, u.role, u.status, u.created_at,
        ep.phone, ep.skills, ep.experience, ep.portfolio_link, ep.payment_rate, ep.internal_notes
      FROM users u
      LEFT JOIN editor_profiles ep ON u.id = ep.user_id
      WHERE u.id = ? AND u.role = 'EDITOR'
      LIMIT 1
    `, [id]);

    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: 'Editor not found.' });
    }

    // Projects assigned to editor
    const [projects] = await db.query(`
      SELECT p.*,
        COALESCE((SELECT SUM(amount) FROM payments WHERE project_id = p.id AND type = 'EDITOR_PAYMENT'), 0) AS editor_paid_amount
      FROM projects p
      WHERE p.editor_id = ?
      ORDER BY p.created_at DESC
    `, [id]);

    res.json({
      success: true,
      editor: sanitizeUser(users[0], 'ADMIN'),
      projects
    });
  } catch (err) {
    next(err);
  }
}

async function createEditor(req, res, next) {
  try {
    const { name, email, password, phone, skills, experience, portfolio_link, payment_rate, internal_notes } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing && existing.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = generateId('u-editor');
    const profileId = generateId('ep');

    await db.query(
      'INSERT INTO users (id, email, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, email.toLowerCase().trim(), passwordHash, name.trim(), 'EDITOR', 'ACTIVE']
    );

    await db.query(
      'INSERT INTO editor_profiles (id, user_id, phone, skills, experience, portfolio_link, payment_rate, internal_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [profileId, userId, phone || null, skills || null, experience || null, portfolio_link || null, parseFloat(payment_rate) || 0.0, internal_notes || null]
    );

    await db.query(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [generateId('aud'), req.user.id, 'EDITOR_CREATED', 'USER', userId, `Created new editor profile for ${name} (${email})`, req.ip || '127.0.0.1']
    );

    res.status(201).json({
      success: true,
      message: 'Editor account created successfully.',
      editor: {
        id: userId,
        name,
        email: email.toLowerCase().trim(),
        role: 'EDITOR',
        status: 'ACTIVE',
        skills,
        experience,
        portfolio_link,
        payment_rate: parseFloat(payment_rate) || 0.0
      }
    });
  } catch (err) {
    next(err);
  }
}

async function updateEditor(req, res, next) {
  try {
    const { id } = req.params;
    const { name, email, phone, skills, experience, portfolio_link, payment_rate, internal_notes, status, password } = req.body;

    const [existing] = await db.query('SELECT id, email FROM users WHERE id = ? AND role = "EDITOR"', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Editor not found.' });
    }

    if (email && email.toLowerCase().trim() !== existing[0].email) {
      const [emailCheck] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email.toLowerCase().trim(), id]);
      if (emailCheck && emailCheck.length > 0) {
        return res.status(409).json({ success: false, message: 'Email is already taken by another account.' });
      }
    }

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await db.query(
        'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), password_hash = ?, status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, email ? email.toLowerCase().trim() : null, passwordHash, status, id]
      );
    } else {
      await db.query(
        'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, email ? email.toLowerCase().trim() : null, status, id]
      );
    }

    await db.query(
      'UPDATE editor_profiles SET phone = ?, skills = ?, experience = ?, portfolio_link = ?, payment_rate = ?, internal_notes = ? WHERE user_id = ?',
      [phone, skills, experience, portfolio_link, parseFloat(payment_rate) || 0.0, internal_notes, id]
    );

    await db.query(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [generateId('aud'), req.user.id, 'EDITOR_UPDATED', 'USER', id, `Updated editor profile ${id}`, req.ip || '127.0.0.1']
    );

    res.json({
      success: true,
      message: 'Editor updated successfully.'
    });
  } catch (err) {
    next(err);
  }
}

async function toggleUserStatus(req, res, next) {
  try {
    const { id } = req.params;
    const [users] = await db.query('SELECT id, name, role, status FROM users WHERE id = ?', [id]);
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const currentStatus = users[0].status;
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    await db.query('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id]);

    await db.query(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [generateId('aud'), req.user.id, 'USER_STATUS_TOGGLED', 'USER', id, `Changed status of ${users[0].name} to ${newStatus}`, req.ip || '127.0.0.1']
    );

    res.json({
      success: true,
      message: `Account status updated to ${newStatus}`,
      status: newStatus
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  getEditors,
  getEditorById,
  createEditor,
  updateEditor,
  toggleUserStatus
};
