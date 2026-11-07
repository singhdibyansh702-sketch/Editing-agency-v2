const db = require('../db');
const { sanitizeProject, sanitizeProjects } = require('../middleware/sanitizer');

function generateId(prefix = 'prj') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
}

async function getNextProjectCode() {
  const [rows] = await db.query('SELECT project_code FROM projects');
  let maxNum = 1000;
  if (rows && rows.length > 0) {
    for (const r of rows) {
      if (r.project_code) {
        const match = r.project_code.match(/PRJ-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }
  }
  return `PRJ-${maxNum + 1}`;
}

// ==========================================
// LIST PROJECTS (ROLE-BASED & SANITIZED)
// ==========================================

async function getProjects(req, res, next) {
  try {
    const user = req.user;
    const { status, currency, search } = req.query;

    let sql = `
      SELECT 
        p.*,
        cu.name AS client_name,
        cu.email AS client_email,
        cp.company_name AS client_company,
        cp.phone AS client_phone,
        eu.name AS editor_name,
        eu.email AS editor_email,
        ep.portfolio_link AS editor_portfolio,
        COALESCE((SELECT SUM(amount) FROM payments WHERE project_id = p.id AND type = 'CLIENT_PAYMENT' AND status = 'VERIFIED'), 0) AS client_paid_amount,
        COALESCE((SELECT SUM(amount) FROM payments WHERE project_id = p.id AND type = 'EDITOR_PAYMENT' AND status = 'VERIFIED'), 0) AS editor_paid_amount,
        COALESCE((SELECT SUM(deduction_amount) FROM payments WHERE project_id = p.id AND type = 'EDITOR_PAYMENT' AND status = 'VERIFIED'), 0) AS editor_deduction_amount,
        (SELECT deduction_reason FROM payments WHERE project_id = p.id AND type = 'EDITOR_PAYMENT' AND deduction_amount > 0 ORDER BY id DESC LIMIT 1) AS deduction_reason,
        COALESCE((SELECT COUNT(*) FROM payments WHERE project_id = p.id AND type = 'CLIENT_PAYMENT' AND status = 'PENDING_VERIFICATION'), 0) AS pending_client_payments
      FROM projects p
      LEFT JOIN users cu ON p.client_id = cu.id
      LEFT JOIN client_profiles cp ON cu.id = cp.user_id
      LEFT JOIN users eu ON p.editor_id = eu.id
      LEFT JOIN editor_profiles ep ON eu.id = ep.user_id
      WHERE 1=1
    `;

    const params = [];

    // Role-based scoping
    if (user.role === 'CLIENT') {
      sql += ' AND p.client_id = ?';
      params.push(user.id);
    } else if (user.role === 'EDITOR') {
      sql += ' AND p.editor_id = ?';
      params.push(user.id);
    }

    // Status filter
    if (status && status !== 'ALL') {
      sql += ' AND p.status = ?';
      params.push(status);
    }

    // Currency filter
    if (currency && currency !== 'ALL') {
      sql += ' AND p.currency = ?';
      params.push(currency);
    }

    // Search query
    if (search && search.trim()) {
      sql += ' AND (p.title LIKE ? OR p.project_code LIKE ? OR p.video_type LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY p.created_at DESC';

    const [projects] = await db.query(sql, params);

    // Calculate billing & payment status for each
    const enriched = projects.map(p => {
      const clientPrice = parseFloat(p.client_price || 0);
      const clientPaid = parseFloat(p.client_paid_amount || 0);
      const pendingClientCount = parseInt(p.pending_client_payments || 0);
      const clientBal = Math.max(0, +(clientPrice - clientPaid).toFixed(2));
      let clientPayStatus = 'UNPAID';
      if (clientPaid >= clientPrice && clientPrice > 0) clientPayStatus = 'PAID';
      else if (pendingClientCount > 0) clientPayStatus = 'PENDING_VERIFICATION';
      else if (clientPaid > 0) clientPayStatus = 'PARTIALLY_PAID';

      const editorPayment = parseFloat(p.editor_payment || 0);
      const editorPaid = parseFloat(p.editor_paid_amount || 0);
      const editorDeduction = parseFloat(p.editor_deduction_amount || 0);
      const editorBal = Math.max(0, +(editorPayment - (editorPaid + editorDeduction)).toFixed(2));
      let editorPayStatus = 'UNPAID';
      if ((editorPaid + editorDeduction) >= editorPayment && editorPayment > 0) editorPayStatus = 'PAID';
      else if (editorPaid > 0) editorPayStatus = 'PARTIALLY_PAID';

      return {
        ...p,
        client_remaining_balance: clientBal,
        client_payment_status: clientPayStatus,
        editor_remaining_balance: editorBal,
        editor_payment_status: editorPayStatus,
        editor_deduction_amount: editorDeduction,
        pending_client_payments: pendingClientCount
      };
    });

    res.json({
      success: true,
      projects: sanitizeProjects(enriched, user.role)
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// GET SINGLE PROJECT DETAILS
// ==========================================

async function getProjectById(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.user;

    const [rows] = await db.query(`
      SELECT 
        p.*,
        cu.name AS client_name,
        cu.email AS client_email,
        cp.company_name AS client_company,
        cp.phone AS client_phone,
        eu.name AS editor_name,
        eu.email AS editor_email,
        ep.portfolio_link AS editor_portfolio,
        COALESCE((SELECT SUM(amount) FROM payments WHERE project_id = p.id AND type = 'CLIENT_PAYMENT' AND status = 'VERIFIED'), 0) AS client_paid_amount,
        COALESCE((SELECT SUM(amount) FROM payments WHERE project_id = p.id AND type = 'EDITOR_PAYMENT' AND status = 'VERIFIED'), 0) AS editor_paid_amount,
        COALESCE((SELECT SUM(deduction_amount) FROM payments WHERE project_id = p.id AND type = 'EDITOR_PAYMENT' AND status = 'VERIFIED'), 0) AS editor_deduction_amount,
        (SELECT deduction_reason FROM payments WHERE project_id = p.id AND type = 'EDITOR_PAYMENT' AND deduction_amount > 0 ORDER BY id DESC LIMIT 1) AS deduction_reason,
        COALESCE((SELECT COUNT(*) FROM payments WHERE project_id = p.id AND type = 'CLIENT_PAYMENT' AND status = 'PENDING_VERIFICATION'), 0) AS pending_client_payments
      FROM projects p
      LEFT JOIN users cu ON p.client_id = cu.id
      LEFT JOIN client_profiles cp ON cu.id = cp.user_id
      LEFT JOIN users eu ON p.editor_id = eu.id
      LEFT JOIN editor_profiles ep ON eu.id = ep.user_id
      WHERE p.id = ?
      LIMIT 1
    `, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const project = rows[0];

    // Compute balance and payment status
    const clientPrice = parseFloat(project.client_price || 0);
    const clientPaid = parseFloat(project.client_paid_amount || 0);
    const clientBal = Math.max(0, +(clientPrice - clientPaid).toFixed(2));
    let clientPayStatus = 'UNPAID';
    if (clientPaid >= clientPrice && clientPrice > 0) clientPayStatus = 'PAID';
    else if (clientPaid > 0) clientPayStatus = 'PARTIALLY_PAID';

    const editorPayment = parseFloat(project.editor_payment || 0);
    const editorPaid = parseFloat(project.editor_paid_amount || 0);
    const editorDeduction = parseFloat(project.editor_deduction_amount || 0);
    const editorBal = Math.max(0, +(editorPayment - (editorPaid + editorDeduction)).toFixed(2));
    let editorPayStatus = 'UNPAID';
    if ((editorPaid + editorDeduction) >= editorPayment && editorPayment > 0) editorPayStatus = 'PAID';
    else if (editorPaid > 0) editorPayStatus = 'PARTIALLY_PAID';

    project.client_remaining_balance = clientBal;
    project.client_payment_status = clientPayStatus;
    project.editor_remaining_balance = editorBal;
    project.editor_payment_status = editorPayStatus;

    // Verify role permissions
    if (user.role === 'CLIENT' && project.client_id !== user.id) {
      return res.status(403).json({ success: false, message: 'Access denied to this project.' });
    }
    if (user.role === 'EDITOR' && project.editor_id !== user.id) {
      return res.status(403).json({ success: false, message: 'Access denied to this project.' });
    }

    // Fetch submissions
    const [submissions] = await db.query(
      'SELECT * FROM project_submissions WHERE project_id = ? ORDER BY version DESC, created_at DESC',
      [id]
    );

    // Fetch payments
    let paymentsQuery = 'SELECT * FROM payments WHERE project_id = ? ORDER BY payment_date DESC';
    const [payments] = await db.query(paymentsQuery, [id]);

    // Sanitize payments according to viewer
    let visiblePayments = payments;
    if (user.role === 'CLIENT') {
      visiblePayments = payments.filter(pm => pm.type === 'CLIENT_PAYMENT');
    } else if (user.role === 'EDITOR') {
      visiblePayments = payments.filter(pm => pm.type === 'EDITOR_PAYMENT');
    }

    res.json({
      success: true,
      project: sanitizeProject(project, user.role),
      submissions,
      payments: visiblePayments
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// CREATE PROJECT (CLIENT OR ADMIN)
// ==========================================

async function createProject(req, res, next) {
  try {
    const user = req.user;
    const {
      title,
      description,
      video_type,
      editing_requirements,
      reference_link,
      spec_doc_url,
      currency,
      client_budget,
      client_id,
      editor_id,
      client_price,
      editor_payment,
      admin_quote_note,
      deadline,
      status
    } = req.body;

    if (!title || !video_type) {
      return res.status(400).json({ success: false, message: 'Project title and video type are required.' });
    }

    const projectId = generateId('prj');
    const projectCode = await getNextProjectCode();
    const curr = (currency && ['USD', 'INR'].includes(currency.toUpperCase())) ? currency.toUpperCase() : 'USD';

    let actualClientId = user.id;
    let actualStatus = 'Pending Approval';
    let actualClientPrice = 0.00;
    let actualEditorId = null;
    let actualEditorPayment = 0.00;
    let actualQuoteNote = null;

    if (user.role === 'ADMIN') {
      if (!client_id) {
        return res.status(400).json({ success: false, message: 'Client selection is required when Admin creates a project.' });
      }
      actualClientId = client_id;
      actualStatus = status || 'In Progress';
      actualClientPrice = parseFloat(client_price) || 0.00;
      actualEditorId = editor_id || null;
      actualEditorPayment = parseFloat(editor_payment) || 0.00;
      actualQuoteNote = admin_quote_note || null;
    }

    await db.query(
      `INSERT INTO projects (
        id, project_code, title, description, video_type, editing_requirements,
        reference_link, spec_doc_url, currency, client_budget, client_price,
        admin_quote_note, client_id, editor_id, editor_payment, status,
        deadline, start_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        projectCode,
        title.trim(),
        description || null,
        video_type,
        editing_requirements || null,
        reference_link || null,
        spec_doc_url || null,
        curr,
        parseFloat(client_budget) || null,
        actualClientPrice,
        actualQuoteNote,
        actualClientId,
        actualEditorId,
        actualEditorPayment,
        actualStatus,
        deadline || null,
        user.role === 'ADMIN' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null
      ]
    );

    // Process advance payment if provided by client
    let advancePaymentCreated = false;
    if (req.body.advance_payment && typeof req.body.advance_payment === 'object') {
      const adv = req.body.advance_payment;
      const advAmount = parseFloat(adv.amount || 0);
      if (advAmount > 0 && adv.payment_method) {
        const advPmtId = generateId('pmt');
        await db.query(
          `INSERT INTO payments (
            id, project_id, type, amount, currency, payment_method, payment_date,
            reference_id, notes, status, payer_user_id, receipt_url
          ) VALUES (?, ?, 'CLIENT_PAYMENT', ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 'PENDING_VERIFICATION', ?, ?)`,
          [
            advPmtId,
            projectId,
            advAmount,
            curr,
            adv.payment_method,
            adv.reference_id || 'ADV-UTR-PENDING',
            adv.notes || 'Advance Deposit',
            user.id,
            adv.receipt_url || null
          ]
        );
        await db.query('UPDATE projects SET advance_payment_status = "PENDING" WHERE id = ?', [projectId]);
        advancePaymentCreated = true;
      }
    }

    // Notify Admin of new client submission
    if (user.role === 'CLIENT') {
      const [admins] = await db.query('SELECT id FROM users WHERE role = "ADMIN"');
      const advMsg = advancePaymentCreated ? ` (With Advance Deposit of ${curr === 'INR' ? '₹' : '$'}${req.body.advance_payment.amount})` : '';
      for (const adm of admins) {
        await db.query(
          'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
          [
            generateId('ntf'),
            adm.id,
            'New Project Request Submitted',
            `Client requested "${title}" (${projectCode}) with proposed budget of ${curr === 'INR' ? '₹' : '$'}${client_budget || 0}${advMsg}.`,
            '/#projects',
            'PROJECT_REQUEST'
          ]
        );
      }
    } else if (actualEditorId) {
      // Admin created and assigned editor directly
      await db.query(
        'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
        [
          generateId('ntf'),
          actualEditorId,
          'New Project Assigned',
          `You have been assigned to project "${title}" (${projectCode}). Agreed payout: ${curr === 'INR' ? '₹' : '$'}${actualEditorPayment}.`,
          '/#projects',
          'ASSIGNMENT'
        ]
      );
    }

    // Audit log
    await db.query(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        generateId('aud'),
        user.id,
        'PROJECT_CREATED',
        'PROJECT',
        projectId,
        `${user.name} created project ${projectCode} "${title}" (Status: ${actualStatus})`,
        req.ip || '127.0.0.1'
      ]
    );

    res.status(201).json({
      success: true,
      message: user.role === 'CLIENT' ? 'Project request submitted for admin review!' : 'Project created successfully.',
      project: {
        id: projectId,
        project_code: projectCode,
        title,
        status: actualStatus,
        currency: curr
      }
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// ADMIN REVIEW & COUNTER-QUOTE WORKFLOW
// ==========================================

async function reviewAndQuoteProject(req, res, next) {
  try {
    const { id } = req.params;
    const {
      client_price,
      admin_quote_note,
      editor_id,
      editor_payment,
      deadline,
      status
    } = req.body;

    const [existing] = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const currentProject = existing[0];
    const assignedEditorId = editor_id !== undefined ? (editor_id || null) : currentProject.editor_id;
    let newStatus = status;
    if (!newStatus) {
      if (assignedEditorId) {
        newStatus = 'Waiting for Editor';
      } else {
        newStatus = 'In Progress';
      }
    }
    const finalClientPrice = client_price !== undefined ? parseFloat(client_price) : currentProject.client_price;
    const finalEditorPayment = editor_payment !== undefined ? parseFloat(editor_payment) : currentProject.editor_payment;

    await db.query(
      `UPDATE projects SET
        client_price = ?,
        admin_quote_note = ?,
        editor_id = ?,
        editor_payment = ?,
        deadline = COALESCE(?, deadline),
        status = ?,
        start_date = COALESCE(start_date, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        finalClientPrice,
        admin_quote_note !== undefined ? admin_quote_note : currentProject.admin_quote_note,
        assignedEditorId,
        finalEditorPayment,
        deadline || null,
        newStatus,
        id
      ]
    );

    const currencySymbol = currentProject.currency === 'INR' ? '₹' : '$';

    // Notify Client with quote and note (WITHOUT editor details)
    await db.query(
      'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
      [
        generateId('ntf'),
        currentProject.client_id,
        'Project Quote & Agreement Ready',
        `Your project "${currentProject.title}" has been reviewed! Final Quoted Price: ${currencySymbol}${finalClientPrice.toLocaleString()}. Status: ${newStatus}.`,
        '/#projects',
        'QUOTE_READY'
      ]
    );

    // Notify Assigned Editor with payout (WITHOUT client details)
    if (assignedEditorId) {
      await db.query(
        'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
        [
          generateId('ntf'),
          assignedEditorId,
          'New Project Assigned',
          `You have been assigned to project "${currentProject.title}" (${currentProject.project_code}). Agreed payout: ${currencySymbol}${finalEditorPayment.toLocaleString()}.`,
          '/#projects',
          'ASSIGNMENT'
        ]
      );
    }

    // Audit Log
    await db.query(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        generateId('aud'),
        req.user.id,
        'PROJECT_QUOTE_APPROVED',
        'PROJECT',
        id,
        `Admin quoted ${currencySymbol}${finalClientPrice} for client and assigned editor with ${currencySymbol}${finalEditorPayment} payout. Status: ${newStatus}`,
        req.ip || '127.0.0.1'
      ]
    );

    res.json({
      success: true,
      message: 'Project quote, editor assignment, and deadline updated successfully.'
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// EDITOR SUBMISSION WORKFLOW
// ==========================================

async function submitCut(req, res, next) {
  try {
    const { id } = req.params;
    const { submission_link, notes } = req.body;
    const user = req.user;

    if (!submission_link) {
      return res.status(400).json({ success: false, message: 'Video submission link (Google Drive / Dropbox) is required.' });
    }

    const [projects] = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (!projects || projects.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const project = projects[0];
    if (user.role === 'EDITOR' && project.editor_id !== user.id) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this project.' });
    }

    // Determine version number
    const [lastSub] = await db.query(
      'SELECT MAX(version) as max_v FROM project_submissions WHERE project_id = ?',
      [id]
    );
    const version = (lastSub && lastSub[0] && lastSub[0].max_v) ? lastSub[0].max_v + 1 : 1;

    const subId = generateId('sub');

    await db.query(
      `INSERT INTO project_submissions (id, project_id, editor_id, submission_link, notes, version, status)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING_REVIEW')`,
      [subId, id, user.id, submission_link.trim(), notes || null, version]
    );

    // Update project status to 'Submitted for Review'
    await db.query(
      'UPDATE projects SET status = "Submitted for Review", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    // Notify Admin
    const [admins] = await db.query('SELECT id FROM users WHERE role = "ADMIN"');
    for (const adm of admins) {
      await db.query(
        'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
        [
          generateId('ntf'),
          adm.id,
          'New Cut Submitted for Review',
          `Editor submitted Cut Version ${version} for project "${project.title}" (${project.project_code}).`,
          '/#projects',
          'SUBMISSION'
        ]
      );
    }

    // Audit log
    await db.query(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        generateId('aud'),
        user.id,
        'CUT_SUBMITTED',
        'PROJECT_SUBMISSION',
        subId,
        `Submitted Cut v${version} for project ${project.project_code}`,
        req.ip || '127.0.0.1'
      ]
    );

    res.status(201).json({
      success: true,
      message: `Cut Version ${version} submitted successfully! Admin has been notified for quality review.`
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// ADMIN CUT REVIEW & REVISION REQUEST
// ==========================================

async function reviewCut(req, res, next) {
  try {
    const { id } = req.params; // project id
    const { submission_id, action, notes } = req.body; // action: 'APPROVE' or 'REQUEST_REVISION'

    const [projects] = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (!projects || projects.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }
    const project = projects[0];

    if (action === 'REQUEST_REVISION') {
      if (!notes) {
        return res.status(400).json({ success: false, message: 'Revision notes and detailed feedback are required.' });
      }

      if (submission_id) {
        await db.query(
          'UPDATE project_submissions SET status = "REVISION_REQUESTED" WHERE id = ?',
          [submission_id]
        );
      }

      await db.query(
        'UPDATE projects SET status = "Revision Required", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );

      if (project.editor_id) {
        await db.query(
          'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
          [
            generateId('ntf'),
            project.editor_id,
            'Revision Requested on Project',
            `Admin requested revisions for "${project.title}": "${notes}"`,
            '/#projects',
            'REVISION'
          ]
        );
      }

      await db.query(
        'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [generateId('aud'), req.user.id, 'REVISION_REQUESTED', 'PROJECT', id, `Requested revisions on cut: ${notes}`, req.ip || '127.0.0.1']
      );

      return res.json({
        success: true,
        message: 'Revision request logged and editor notified.'
      });
    } else if (action === 'APPROVE') {
      if (submission_id) {
        await db.query(
          'UPDATE project_submissions SET status = "APPROVED" WHERE id = ?',
          [submission_id]
        );
      }

      await db.query(
        'UPDATE projects SET status = "Approved", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );

      if (project.editor_id) {
        await db.query(
          'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
          [
            generateId('ntf'),
            project.editor_id,
            'Cut Approved!',
            `Your cut for project "${project.title}" has been approved by the Admin team!`,
            '/#projects',
            'APPROVAL'
          ]
        );
      }

      await db.query(
        'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [generateId('aud'), req.user.id, 'CUT_APPROVED', 'PROJECT', id, 'Admin approved editor cut.', req.ip || '127.0.0.1']
      );

      return res.json({
        success: true,
        message: 'Editor cut approved.'
      });
    }

    res.status(400).json({ success: false, message: 'Invalid action. Must be APPROVE or REQUEST_REVISION.' });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// ADMIN DELIVER & MARK COMPLETED
// ==========================================

async function completeProject(req, res, next) {
  try {
    const { id } = req.params;
    const { final_delivery_link } = req.body;

    const [projects] = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (!projects || projects.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }
    const project = projects[0];

    await db.query(
      'UPDATE projects SET status = "Completed", final_delivery_link = COALESCE(?, final_delivery_link), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [final_delivery_link || null, id]
    );

    // Notify Client
    await db.query(
      'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
      [
        generateId('ntf'),
        project.client_id,
        'Final Deliverables Ready!',
        `Your project "${project.title}" (${project.project_code}) is completed! Click to download your final master video files.`,
        final_delivery_link || '/#projects',
        'DELIVERY'
      ]
    );

    // Notify Editor
    if (project.editor_id) {
      await db.query(
        'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
        [
          generateId('ntf'),
          project.editor_id,
          'Project Marked Completed',
          `Project "${project.title}" has been finalized and delivered to client.`,
          '/#projects',
          'COMPLETED'
        ]
      );
    }

    await db.query(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [generateId('aud'), req.user.id, 'PROJECT_COMPLETED', 'PROJECT', id, `Project marked completed with final delivery link: ${final_delivery_link}`, req.ip || '127.0.0.1']
    );

    res.json({
      success: true,
      message: 'Project marked completed and master delivery link sent to client!'
    });
  } catch (err) {
    next(err);
  }
}

async function cancelProject(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await db.query('UPDATE projects SET status = "Cancelled", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

    await db.query(
      'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [generateId('aud'), req.user.id, 'PROJECT_CANCELLED', 'PROJECT', id, `Project cancelled: ${reason || 'No reason provided'}`, req.ip || '127.0.0.1']
    );

    res.json({
      success: true,
      message: 'Project status set to Cancelled.'
    });
  } catch (err) {
    next(err);
  }
}

async function deleteProject(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.user;

    const [projects] = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (!projects || projects.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }
    const project = projects[0];

    // Privacy & permission boundary: Client can only delete their own project. Admin can delete any.
    if (user.role === 'CLIENT' && project.client_id !== user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this project.'
      });
    }

    if (user.role === 'EDITOR') {
      return res.status(403).json({
        success: false,
        message: 'Editors are not authorized to delete projects.'
      });
    }

    // Clean up dependent child records
    await db.query('DELETE FROM payments WHERE project_id = ?', [id]);
    await db.query('DELETE FROM project_submissions WHERE project_id = ?', [id]);
    await db.query('UPDATE direct_messages SET project_id = NULL WHERE project_id = ?', [id]);
    await db.query('DELETE FROM projects WHERE id = ?', [id]);

    // Audit log
    try {
      await db.query(
        'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [generateId('aud'), user.id, 'PROJECT_DELETED', 'PROJECT', id, `Project deleted: ${project.title} (${project.project_code})`, req.ip || '127.0.0.1']
      );
    } catch {}

    // If client deleted it, notify admin
    if (user.role === 'CLIENT') {
      try {
        const [admins] = await db.query('SELECT id FROM users WHERE role = "ADMIN"');
        for (const adm of admins) {
          await db.query(
            'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
            [
              generateId('ntf'),
              adm.id,
              'Project Deleted by Client',
              `Client deleted project "${project.title}" (${project.project_code}).`,
              '/#projects',
              'PROJECT_DELETED'
            ]
          );
        }
      } catch {}
    }

    res.json({
      success: true,
      message: 'Project successfully deleted.'
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// UPDATE PROJECT (ADMIN OR CLIENT BEFORE APPROVAL)
// ==========================================

async function updateProject(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.user;

    const [existing] = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }
    const project = existing[0];

    if (user.role === 'CLIENT') {
      if (project.client_id !== user.id) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
      // Strict rule: Client can ONLY edit before admin has approved
      if (project.status !== 'Pending Approval' && project.status !== 'Requested') {
        return res.status(403).json({
          success: false,
          message: 'Project has already been reviewed/approved by Admin and can no longer be edited by client.'
        });
      }

      const {
        title,
        video_type,
        editing_requirements,
        reference_link,
        spec_doc_url,
        deadline,
        currency,
        client_budget,
        description
      } = req.body;

      await db.query(
        `UPDATE projects SET
          title = COALESCE(?, title),
          video_type = COALESCE(?, video_type),
          editing_requirements = COALESCE(?, editing_requirements),
          reference_link = COALESCE(?, reference_link),
          spec_doc_url = COALESCE(?, spec_doc_url),
          deadline = COALESCE(?, deadline),
          currency = COALESCE(?, currency),
          client_budget = COALESCE(?, client_budget),
          description = COALESCE(?, description),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          title?.trim() || null,
          video_type || null,
          editing_requirements || null,
          reference_link || null,
          spec_doc_url || null,
          deadline || null,
          currency || null,
          client_budget !== undefined ? parseFloat(client_budget) : null,
          description || null,
          id
        ]
      );

      const [updatedRows] = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
      return res.json({
        success: true,
        message: 'Project request updated successfully.',
        project: sanitizeProject(updatedRows[0], user.role)
      });
    }

    if (user.role === 'ADMIN') {
      const {
        title,
        video_type,
        editing_requirements,
        reference_link,
        spec_doc_url,
        deadline,
        currency,
        client_budget,
        client_price,
        admin_quote_note,
        editor_id,
        editor_payment,
        status,
        description,
        final_delivery_link
      } = req.body;

      await db.query(
        `UPDATE projects SET
          title = COALESCE(?, title),
          video_type = COALESCE(?, video_type),
          editing_requirements = COALESCE(?, editing_requirements),
          reference_link = COALESCE(?, reference_link),
          spec_doc_url = COALESCE(?, spec_doc_url),
          deadline = COALESCE(?, deadline),
          currency = COALESCE(?, currency),
          client_budget = COALESCE(?, client_budget),
          client_price = COALESCE(?, client_price),
          admin_quote_note = COALESCE(?, admin_quote_note),
          editor_id = COALESCE(?, editor_id),
          editor_payment = COALESCE(?, editor_payment),
          status = COALESCE(?, status),
          description = COALESCE(?, description),
          final_delivery_link = COALESCE(?, final_delivery_link),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          title?.trim() || null,
          video_type || null,
          editing_requirements || null,
          reference_link || null,
          spec_doc_url || null,
          deadline || null,
          currency || null,
          client_budget !== undefined ? parseFloat(client_budget) : null,
          client_price !== undefined ? parseFloat(client_price) : null,
          admin_quote_note !== undefined ? admin_quote_note : null,
          editor_id !== undefined ? (editor_id || null) : null,
          editor_payment !== undefined ? parseFloat(editor_payment) : null,
          status || null,
          description || null,
          final_delivery_link || null,
          id
        ]
      );

      const [updatedRows] = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
      return res.json({
        success: true,
        message: 'Project updated successfully.',
        project: sanitizeProject(updatedRows[0], user.role)
      });
    }

    return res.status(403).json({ success: false, message: 'Permission denied.' });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// EDITOR ACCEPT ASSIGNMENT & START WORK
// ==========================================

async function acceptAssignment(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.user;

    const [existing] = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }
    const project = existing[0];

    if (project.editor_id !== user.id) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this project.' });
    }

    await db.query(
      'UPDATE projects SET status = "In Progress", start_date = COALESCE(start_date, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    // Notify Admin
    const [admins] = await db.query('SELECT id FROM users WHERE role = "ADMIN"');
    for (const adm of admins) {
      await db.query(
        'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
        [
          generateId('ntf'),
          adm.id,
          'Editor Accepted Assignment',
          `Editor ${user.name} accepted project "${project.title}" (${project.project_code}) and started editing.`,
          '/#projects',
          'STATUS_UPDATE'
        ]
      );
    }

    // Notify Client
    await db.query(
      'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
      [
        generateId('ntf'),
        project.client_id,
        'Editing Started!',
        `Your project "${project.title}" (${project.project_code}) is now in active production.`,
        '/#projects',
        'STATUS_UPDATE'
      ]
    );

    res.json({
      success: true,
      message: 'Project accepted! Status updated to In Progress.',
      status: 'In Progress'
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// CLIENT REQUEST REVISION
// ==========================================

async function clientRequestRevision(req, res, next) {
  try {
    const { id } = req.params;
    const { revision_notes } = req.body;
    const user = req.user;

    if (!revision_notes || !revision_notes.trim()) {
      return res.status(400).json({ success: false, message: 'Revision instructions and feedback are required.' });
    }

    const [existing] = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }
    const project = existing[0];

    if (project.client_id !== user.id && user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await db.query(
      `UPDATE projects SET
        status = 'Revision Required',
        client_revision_notes = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [revision_notes.trim(), id]
    );

    // Notify Admin
    const [admins] = await db.query('SELECT id FROM users WHERE role = "ADMIN"');
    for (const adm of admins) {
      await db.query(
        'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
        [
          generateId('ntf'),
          adm.id,
          'Client Requested Revisions',
          `Client requested revisions on "${project.title}" (${project.project_code}): "${revision_notes.slice(0, 100)}..."`,
          '/#projects',
          'REVISION_REQUESTED'
        ]
      );
    }

    // Notify Editor if assigned
    if (project.editor_id) {
      await db.query(
        'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
        [
          generateId('ntf'),
          project.editor_id,
          'Revisions Requested by Client',
          `Client submitted feedback for "${project.title}": "${revision_notes.slice(0, 100)}..."`,
          '/#projects',
          'REVISION_REQUESTED'
        ]
      );
    }

    res.json({
      success: true,
      message: 'Revision request submitted to Admin and Editor.'
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// CLIENT APPROVE DELIVERY
// ==========================================

async function clientApproveDelivery(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.user;

    const [existing] = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }
    const project = existing[0];

    if (project.client_id !== user.id && user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await db.query(
      `UPDATE projects SET
        client_approved_at = CURRENT_TIMESTAMP,
        status = 'Approved',
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );

    // Notify Admin
    const [admins] = await db.query('SELECT id FROM users WHERE role = "ADMIN"');
    for (const adm of admins) {
      await db.query(
        'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
        [
          generateId('ntf'),
          adm.id,
          'Client Approved Video Delivery!',
          `Client approved final delivery for "${project.title}" (${project.project_code}). Please verify payment.`,
          '/#projects',
          'APPROVAL'
        ]
      );
    }

    res.json({
      success: true,
      message: 'Delivery approved successfully! You can now proceed to payment.'
    });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// CLIENT SUBMIT PAYMENT (UTR & PROOF)
// ==========================================

async function submitClientPayment(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.user;
    const { amount, payment_method, reference_id, receipt_url, notes } = req.body;

    const pAmount = parseFloat(amount || 0);
    if (!pAmount || pAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
    }
    if (!payment_method) {
      return res.status(400).json({ success: false, message: 'Payment method is required.' });
    }
    if (!reference_id || !reference_id.trim()) {
      return res.status(400).json({ success: false, message: 'UTR / Transaction Reference Number is required.' });
    }

    const [existing] = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }
    const project = existing[0];

    if (project.client_id !== user.id && user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const paymentId = generateId('pmt');
    await db.query(
      `INSERT INTO payments (
        id, project_id, type, amount, currency, payment_method, payment_date,
        reference_id, notes, status, payer_user_id, receipt_url
      ) VALUES (?, ?, 'CLIENT_PAYMENT', ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 'PENDING_VERIFICATION', ?, ?)`,
      [
        paymentId,
        id,
        pAmount,
        project.currency,
        payment_method,
        reference_id.trim(),
        notes || 'Client Payment Submission',
        user.id,
        receipt_url || null
      ]
    );

    const currSymbol = project.currency === 'INR' ? '₹' : '$';

    // Notify Admin
    const [admins] = await db.query('SELECT id FROM users WHERE role = "ADMIN"');
    for (const adm of admins) {
      await db.query(
        'INSERT INTO notifications (id, user_id, title, message, link, type) VALUES (?, ?, ?, ?, ?, ?)',
        [
          generateId('ntf'),
          adm.id,
          'Client Payment Submitted (Verification Required)',
          `Client ${user.name} submitted ${currSymbol}${pAmount.toLocaleString()} via ${payment_method} (UTR: ${reference_id.trim()}) for "${project.title}".`,
          '/#finance',
          'PAYMENT_PENDING'
        ]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Payment details submitted successfully! Agency admin will verify.',
      payment_id: paymentId,
      payment: {
        id: paymentId,
        project_id: id,
        status: 'PENDING_VERIFICATION',
        amount: pAmount,
        currency: project.currency,
        reference_id: reference_id.trim()
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  reviewAndQuoteProject,
  submitCut,
  reviewCut,
  completeProject,
  cancelProject,
  deleteProject,
  updateProject,
  acceptAssignment,
  clientRequestRevision,
  clientApproveDelivery,
  submitClientPayment
};
