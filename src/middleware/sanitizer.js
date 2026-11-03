/**
 * Privacy & Security Boundary Sanitizer
 * Enforces role-based data isolation:
 * - Editors never see client identities, emails, phones, client pricing, or agency margins.
 * - Clients never see editor identities, emails, phones, editor payouts, or agency margins.
 * - Password hashes and internal secrets are completely purged.
 */

function sanitizeUser(user, viewerRole) {
  if (!user) return null;
  const clean = { ...user };
  delete clean.password_hash;

  if (viewerRole !== 'ADMIN') {
    delete clean.internal_notes;
    delete clean.payment_rate;
    if (viewerRole !== user.role && user.role !== 'ADMIN') {
      delete clean.phone;
      delete clean.email;
    }
  }
  return clean;
}

function sanitizeProject(project, viewerRole) {
  if (!project) return null;
  const p = { ...project };

  if (viewerRole === 'CLIENT') {
    // Strictly erase all editor information, rates, and agency margins
    delete p.editor_id;
    delete p.editor_name;
    delete p.editor_email;
    delete p.editor_phone;
    delete p.editor_portfolio;
    delete p.editor_payment;
    delete p.editor_payment_rate;
    delete p.editor_paid_amount;
    delete p.editor_remaining_balance;
    delete p.editor_payment_status;
    delete p.net_margin;
    delete p.margin_percentage;
    delete p.realized_profit;
  } else if (viewerRole === 'EDITOR') {
    // Strictly erase all client information, budget, client price, and agency margins
    delete p.client_id;
    delete p.client_name;
    delete p.client_email;
    delete p.client_phone;
    delete p.client_company;
    delete p.client_notes;
    delete p.client_budget;
    delete p.client_price;
    delete p.client_paid_amount;
    delete p.client_remaining_balance;
    delete p.client_payment_status;
    delete p.admin_quote_note; // Admin quote notes may reference negotiated client fees
    delete p.net_margin;
    delete p.margin_percentage;
    delete p.realized_profit;
  } else if (viewerRole === 'ADMIN') {
    // Admin computes margins
    const clientPrice = parseFloat(p.client_price || 0);
    const editorPayment = parseFloat(p.editor_payment || 0);
    p.net_margin = +(clientPrice - editorPayment).toFixed(2);
    p.margin_percentage = clientPrice > 0 ? +((p.net_margin / clientPrice) * 100).toFixed(1) : 0;
  }

  return p;
}

function sanitizeProjects(projects, viewerRole) {
  if (!Array.isArray(projects)) return [];
  return projects.map(p => sanitizeProject(p, viewerRole));
}

function sanitizePayment(payment, viewerRole) {
  if (!payment) return null;
  const clean = { ...payment };

  if (viewerRole === 'CLIENT') {
    if (clean.type !== 'CLIENT_PAYMENT') return null;
    delete clean.editor_id;
    delete clean.editor_name;
  } else if (viewerRole === 'EDITOR') {
    if (clean.type !== 'EDITOR_PAYMENT') return null;
    delete clean.client_id;
    delete clean.client_name;
    delete clean.client_price;
  }
  return clean;
}

function sanitizePayments(payments, viewerRole) {
  if (!Array.isArray(payments)) return [];
  return payments
    .map(p => sanitizePayment(p, viewerRole))
    .filter(Boolean);
}

module.exports = {
  sanitizeUser,
  sanitizeProject,
  sanitizeProjects,
  sanitizePayment,
  sanitizePayments
};

