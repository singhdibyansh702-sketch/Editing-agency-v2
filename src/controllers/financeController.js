const db = require('../db');

function generateId(prefix = 'pmt') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
}

// ==========================================
// FINANCIAL SNAPSHOT & OVERVIEW (ADMIN ONLY)
// ==========================================

async function getFinancialOverview(req, res, next) {
  try {
    // 1. Fetch all projects with financial fields
    const [projects] = await db.query(`
      SELECT 
        p.id, p.currency, p.client_price, p.editor_payment, p.status,
        COALESCE((SELECT SUM(amount) FROM payments WHERE project_id = p.id AND type = 'CLIENT_PAYMENT'), 0) AS client_paid,
        COALESCE((SELECT SUM(amount) FROM payments WHERE project_id = p.id AND type = 'EDITOR_PAYMENT'), 0) AS editor_paid
      FROM projects p
      WHERE p.status != 'Cancelled'
    `);

    // Separate sums for USD and INR
    const stats = {
      USD: {
        total_client_billed: 0,
        client_payments_received: 0,
        outstanding_client_receivables: 0,
        total_editor_committed: 0,
        editor_payments_made: 0,
        outstanding_editor_payables: 0,
        realized_profit: 0,
        projected_profit: 0
      },
      INR: {
        total_client_billed: 0,
        client_payments_received: 0,
        outstanding_client_receivables: 0,
        total_editor_committed: 0,
        editor_payments_made: 0,
        outstanding_editor_payables: 0,
        realized_profit: 0,
        projected_profit: 0
      }
    };

    projects.forEach(p => {
      const curr = p.currency === 'INR' ? 'INR' : 'USD';
      const cPrice = parseFloat(p.client_price || 0);
      const cPaid = parseFloat(p.client_paid || 0);
      const ePay = parseFloat(p.editor_payment || 0);
      const ePaid = parseFloat(p.editor_paid || 0);

      stats[curr].total_client_billed += cPrice;
      stats[curr].client_payments_received += cPaid;
      stats[curr].outstanding_client_receivables += Math.max(0, cPrice - cPaid);

      stats[curr].total_editor_committed += ePay;
      stats[curr].editor_payments_made += ePaid;
      stats[curr].outstanding_editor_payables += Math.max(0, ePay - ePaid);

      stats[curr].realized_profit += (cPaid - ePaid);
      stats[curr].projected_profit += (cPrice - ePay);
    });

    // Round all figures
    for (const key of ['USD', 'INR']) {
      for (const prop of Object.keys(stats[key])) {
        stats[key][prop] = +stats[key][prop].toFixed(2);
      }
    }

    // Recent payments stream
    const [recentTransactions] = await db.query(`
      SELECT 
        pm.*,
        p.project_code,
        p.title AS project_title,
        p.currency AS project_currency
      FROM payments pm
      JOIN projects p ON pm.project_id = p.id
      ORDER BY pm.payment_date DESC, pm.created_at DESC
      LIMIT 15
    `);

    res.json({
      success: true,
      stats,
      recentTransactions
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// FINANCIAL LEDGER TABLE (ADMIN ONLY)
// ==========================================

async function getLedger(req, res, next) {
  try {
    const { currency, status, search } = req.query;

    let sql = `
      SELECT 
        p.id, p.project_code, p.title, p.video_type, p.currency, p.status, p.created_at,
        p.client_price, p.editor_payment,
        cu.id AS client_id, cu.name AS client_name, cp.company_name AS client_company,
        eu.id AS editor_id, eu.name AS editor_name,
        COALESCE((SELECT SUM(amount) FROM payments WHERE project_id = p.id AND type = 'CLIENT_PAYMENT'), 0) AS client_paid,
        COALESCE((SELECT SUM(amount) FROM payments WHERE project_id = p.id AND type = 'EDITOR_PAYMENT'), 0) AS editor_paid
      FROM projects p
      LEFT JOIN users cu ON p.client_id = cu.id
      LEFT JOIN client_profiles cp ON cu.id = cp.user_id
      LEFT JOIN users eu ON p.editor_id = eu.id
      WHERE 1=1
    `;

    const params = [];

    if (currency && currency !== 'ALL') {
      sql += ' AND p.currency = ?';
      params.push(currency);
    }

    if (status && status !== 'ALL') {
      sql += ' AND p.status = ?';
      params.push(status);
    }

    if (search && search.trim()) {
      sql += ' AND (p.title LIKE ? OR p.project_code LIKE ? OR cu.name LIKE ? OR cp.company_name LIKE ? OR eu.name LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    sql += ' ORDER BY p.created_at DESC';

    const [rows] = await db.query(sql, params);

    const ledger = rows.map(r => {
      const cPrice = parseFloat(r.client_price || 0);
      const cPaid = parseFloat(r.client_paid || 0);
      const cBal = Math.max(0, +(cPrice - cPaid).toFixed(2));
      let cStatus = 'UNPAID';
      if (cPaid >= cPrice && cPrice > 0) cStatus = 'PAID';
      else if (cPaid > 0) cStatus = 'PARTIALLY_PAID';

      const ePay = parseFloat(r.editor_payment || 0);
      const ePaid = parseFloat(r.editor_paid || 0);
      const eBal = Math.max(0, +(ePay - ePaid).toFixed(2));
      let eStatus = 'UNPAID';
      if (ePaid >= ePay && ePay > 0) eStatus = 'PAID';
      else if (ePaid > 0) eStatus = 'PARTIALLY_PAID';

      const netMargin = +(cPrice - ePay).toFixed(2);
      const marginPercent = cPrice > 0 ? +((netMargin / cPrice) * 100).toFixed(1) : 0;
      const realizedProfit = +(cPaid - ePaid).toFixed(2);

      return {
        ...r,
        client_price: cPrice,
        client_paid: cPaid,
        client_balance: cBal,
        client_payment_status: cStatus,
        editor_payment: ePay,
        editor_paid: ePaid,
        editor_balance: eBal,
        editor_payment_status: eStatus,
        net_margin: netMargin,
        margin_percent: marginPercent,
        realized_profit: realizedProfit
      };
    });

    res.json({
      success: true,
      ledger
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// RECORD TRANSACTION (ADMIN ONLY)
// ==========================================

async function recordPayment(req, res, next) {
  try {
    const {
      project_id,
      type, // 'CLIENT_PAYMENT' or 'EDITOR_PAYMENT'
      amount,
      currency,
      payment_method,
      payment_date,
      reference_id,
      notes
    } = req.body;

    if (!project_id || !type || !amount || !payment_method) {
      return res.status(400).json({
        success: false,
        message: 'Project ID, payment type, amount, and payment method are required.'
      });
    }

    const [projects] = await db.query('SELECT * FROM projects WHERE id = ?', [project_id]);
    if (!projects || projects.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }
    const project = projects[0];

    const paymentId = generateId('pmt');
    const paymentAmount = parseFloat(amount);
    const paymentCurrency = currency || project.currency;
    const dateStr = payment_date ? new Date(payment_date).toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ');

    await db.query(
      `INSERT INTO payments (id, project_id, type, amount, currency, payment_method, payment_date, reference_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentId,
        project_id,
        type,
        paymentAmount,
        paymentCurrency,
        payment_method,
        dateStr,
        reference_id || null,
        notes || null
      ]
    );

    const currSymbol = paymentCurrency === 'INR' ? '₹' : '$';

    // Notify appropriate user
    if (type === 'CLIENT_PAYMENT') {
      await db.query(
        'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
        [
          generateId('ntf'),
          project.client_id,
          'Payment Receipt Confirmed',
          `Payment of ${currSymbol}${paymentAmount.toLocaleString()} via ${payment_method} has been credited to your project ${project.project_code}.`,
          '/#projects',
          'PAYMENT'
        ]
      );
    } else if (type === 'EDITOR_PAYMENT' && project.editor_id) {
      await db.query(
        'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
        [
          generateId('ntf'),
          project.editor_id,
          'Payout Dispatched',
          `Payout of ${currSymbol}${paymentAmount.toLocaleString()} via ${payment_method} has been sent for project ${project.project_code}.`,
          '/#projects',
          'PAYMENT'
        ]
      );
    }

    // Audit log
    await db.query(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        generateId('aud'),
        req.user.id,
        'PAYMENT_RECORDED',
        'PAYMENT',
        paymentId,
        `Recorded ${type}: ${currSymbol}${paymentAmount.toLocaleString()} via ${payment_method} for project ${project.project_code}`,
        req.ip || '127.0.0.1'
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully.',
      payment_id: paymentId
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getFinancialOverview,
  getLedger,
  recordPayment
};

