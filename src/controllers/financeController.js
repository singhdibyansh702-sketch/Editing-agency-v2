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
        COALESCE((SELECT SUM(amount) FROM payments WHERE project_id = p.id AND type = 'CLIENT_PAYMENT' AND status = 'VERIFIED'), 0) AS client_paid,
        COALESCE((SELECT SUM(amount) FROM payments WHERE project_id = p.id AND type = 'EDITOR_PAYMENT' AND status = 'VERIFIED'), 0) AS editor_paid
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

    // 2. Fetch all verified payments to compute time-based profit / loss
    const [allVerifiedPayments] = await db.query(`
      SELECT pm.*, p.currency as project_currency
      FROM payments pm
      JOIN projects p ON pm.project_id = p.id
      WHERE pm.status = 'VERIFIED'
    `);

    const now = new Date();
    const periods = {
      day: 1 * 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
      three_year: 3 * 365 * 24 * 60 * 60 * 1000,
      all: Infinity
    };

    const performance = {};

    for (const [periodKey, ms] of Object.entries(periods)) {
      performance[periodKey] = {
        USD: { client_received: 0, editor_paid: 0, net_profit_loss: 0, margin_pct: 0, is_loss: false },
        INR: { client_received: 0, editor_paid: 0, net_profit_loss: 0, margin_pct: 0, is_loss: false }
      };

      allVerifiedPayments.forEach(pm => {
        const pmDate = new Date(pm.payment_date || pm.created_at);
        const diffMs = now - pmDate;
        if (ms === Infinity || diffMs <= ms) {
          const curr = pm.currency === 'INR' ? 'INR' : 'USD';
          const amt = parseFloat(pm.amount || 0);
          if (pm.type === 'CLIENT_PAYMENT') {
            performance[periodKey][curr].client_received += amt;
          } else if (pm.type === 'EDITOR_PAYMENT') {
            performance[periodKey][curr].editor_paid += amt;
          }
        }
      });

      for (const curr of ['USD', 'INR']) {
        const cRec = performance[periodKey][curr].client_received;
        const ePaid = performance[periodKey][curr].editor_paid;
        const net = +(cRec - ePaid).toFixed(2);
        performance[periodKey][curr].client_received = +cRec.toFixed(2);
        performance[periodKey][curr].editor_paid = +ePaid.toFixed(2);
        performance[periodKey][curr].net_profit_loss = net;
        performance[periodKey][curr].is_loss = net < 0;
        if (cRec > 0) {
          performance[periodKey][curr].margin_pct = +((net / cRec) * 100).toFixed(1);
        } else if (ePaid > 0) {
          performance[periodKey][curr].margin_pct = -100.0;
        } else {
          performance[periodKey][curr].margin_pct = 0.0;
        }
      }
    }

    // 3. Pending client payments awaiting Admin verification
    const [pendingVerifications] = await db.query(`
      SELECT 
        pm.*,
        p.project_code,
        p.title AS project_title,
        p.currency AS project_currency,
        cu.name AS client_name,
        cu.email AS client_email
      FROM payments pm
      JOIN projects p ON pm.project_id = p.id
      JOIN users cu ON p.client_id = cu.id
      WHERE pm.status = 'PENDING_VERIFICATION'
      ORDER BY pm.created_at DESC
    `);

    // 4. Recent transactions stream
    const [recentTransactions] = await db.query(`
      SELECT 
        pm.*,
        p.project_code,
        p.title AS project_title,
        p.currency AS project_currency
      FROM payments pm
      JOIN projects p ON pm.project_id = p.id
      ORDER BY pm.payment_date DESC, pm.created_at DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      stats,
      performance,
      periods: performance,
      pendingVerifications,
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
        COALESCE((SELECT SUM(amount) FROM payments WHERE project_id = p.id AND type = 'CLIENT_PAYMENT' AND status = 'VERIFIED'), 0) AS client_paid,
        COALESCE((SELECT SUM(amount) FROM payments WHERE project_id = p.id AND type = 'EDITOR_PAYMENT' AND status = 'VERIFIED'), 0) AS editor_paid,
        COALESCE((SELECT SUM(deduction_amount) FROM payments WHERE project_id = p.id AND type = 'EDITOR_PAYMENT' AND status = 'VERIFIED'), 0) AS editor_deduction,
        COALESCE((SELECT COUNT(*) FROM payments WHERE project_id = p.id AND type = 'CLIENT_PAYMENT' AND status = 'PENDING_VERIFICATION'), 0) AS pending_client_payments
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
      const cPending = parseInt(r.pending_client_payments || 0);
      const cBal = Math.max(0, +(cPrice - cPaid).toFixed(2));
      let cStatus = 'UNPAID';
      if (cPaid >= cPrice && cPrice > 0) cStatus = 'PAID';
      else if (cPending > 0) cStatus = 'PENDING_VERIFICATION';
      else if (cPaid > 0) cStatus = 'PARTIALLY_PAID';

      const ePay = parseFloat(r.editor_payment || 0);
      const ePaid = parseFloat(r.editor_paid || 0);
      const eDeduction = parseFloat(r.editor_deduction || 0);
      const eBal = Math.max(0, +(ePay - (ePaid + eDeduction)).toFixed(2));
      let eStatus = 'UNPAID';
      if ((ePaid + eDeduction) >= ePay && ePay > 0) eStatus = 'PAID';
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
        editor_deduction: eDeduction,
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
      notes,
      deduction_amount,
      deduction_reason
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
    const dedAmt = parseFloat(deduction_amount) || 0.00;
    const dedReason = deduction_reason || null;

    await db.query(
      `INSERT INTO payments (
        id, project_id, type, amount, currency, payment_method, payment_date,
        reference_id, notes, status, deduction_amount, deduction_reason, verified_at, verified_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'VERIFIED', ?, ?, CURRENT_TIMESTAMP, ?)`,
      [
        paymentId,
        project_id,
        type,
        paymentAmount,
        paymentCurrency,
        payment_method,
        dateStr,
        reference_id || null,
        notes || null,
        dedAmt,
        dedReason,
        req.user.id
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
      const deductionNote = dedAmt > 0 ? ` (Adjusted with ${currSymbol}${dedAmt} deduction: ${dedReason || 'Performance adjustment'})` : '';
      await db.query(
        'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
        [
          generateId('ntf'),
          project.editor_id,
          'Payout Dispatched & Settled',
          `Payout of ${currSymbol}${paymentAmount.toLocaleString()} via ${payment_method}${deductionNote} has been recorded for project ${project.project_code}.`,
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
      message: 'Payment recorded and verified successfully.',
      payment_id: paymentId
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// APPROVE CLIENT PAYMENT (ADMIN ONLY)
// ==========================================

async function approvePayment(req, res, next) {
  try {
    const { id } = req.params;

    const [payments] = await db.query(
      `SELECT pm.*, p.title as project_title, p.project_code, p.client_id, p.currency as project_currency
       FROM payments pm
       JOIN projects p ON pm.project_id = p.id
       WHERE pm.id = ?`,
      [id]
    );

    if (!payments || payments.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    const payment = payments[0];

    await db.query(
      `UPDATE payments SET
        status = 'VERIFIED',
        verified_at = CURRENT_TIMESTAMP,
        verified_by = ?
       WHERE id = ?`,
      [req.user.id, id]
    );

    // Update project advance payment status if it was pending
    await db.query(
      `UPDATE projects SET advance_payment_status = 'VERIFIED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND advance_payment_status = 'PENDING'`,
      [payment.project_id]
    );

    const currSymbol = payment.currency === 'INR' ? '₹' : '$';

    // Notify Client
    await db.query(
      'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
      [
        generateId('ntf'),
        payment.client_id,
        'Payment Verified & Approved!',
        `Your payment of ${currSymbol}${parseFloat(payment.amount).toLocaleString()} (UTR: ${payment.reference_id || 'N/A'}) for project "${payment.project_title}" has been verified.`,
        '/#projects',
        'PAYMENT_VERIFIED'
      ]
    );

    // Audit log
    await db.query(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        generateId('aud'),
        req.user.id,
        'PAYMENT_VERIFIED',
        'PAYMENT',
        id,
        `Admin approved payment ${id} (${currSymbol}${payment.amount}) for ${payment.project_code}`,
        req.ip || '127.0.0.1'
      ]
    );

    res.json({
      success: true,
      message: 'Payment verified and approved successfully.',
      payment_id: id,
      project_id: payment.project_id
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// REJECT CLIENT PAYMENT (ADMIN ONLY)
// ==========================================

async function rejectPayment(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const [payments] = await db.query(
      `SELECT pm.*, p.title as project_title, p.project_code, p.client_id
       FROM payments pm
       JOIN projects p ON pm.project_id = p.id
       WHERE pm.id = ?`,
      [id]
    );

    if (!payments || payments.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    const payment = payments[0];

    await db.query(
      `UPDATE payments SET
        status = 'REJECTED',
        notes = COALESCE(?, notes),
        verified_at = CURRENT_TIMESTAMP,
        verified_by = ?
       WHERE id = ?`,
      [reason ? `Rejected: ${reason}` : null, req.user.id, id]
    );

    // Notify client
    await db.query(
      'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
      [
        generateId('ntf'),
        payment.client_id,
        'Payment Verification Unsuccessful',
        `Payment submission for project "${payment.project_title}" could not be verified.${reason ? ` Reason: ${reason}` : ' Please re-submit valid UTR or contact agency support.'}`,
        '/#projects',
        'PAYMENT_REJECTED'
      ]
    );

    res.json({
      success: true,
      message: 'Payment marked as rejected.'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getFinancialOverview,
  getLedger,
  recordPayment,
  approvePayment,
  rejectPayment
};

