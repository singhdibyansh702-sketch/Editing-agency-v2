/**
 * Global Reactive State & Presentation Helpers
 */

const State = {
  currentUser: null,
  activeTab: 'overview',
  projects: [],
  clients: [],
  editors: [],
  financeStats: null,
  ledger: [],
  notifications: [],
  unreadNotifications: 0,
  activeChatRecipient: null,
  currencyPreference: 'USD', // or 'INR'

  formatCurrency(amount, currency = 'USD') {
    const val = parseFloat(amount || 0);
    const curr = (currency || 'USD').toUpperCase();
    if (curr === 'INR') {
      return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  },

  getStatusBadge(status) {
    const s = status || 'Unknown';
    let badgeClass = 'badge-pending';
    
    if (s === 'In Progress' || s === 'Assigned') badgeClass = 'badge-progress';
    else if (s === 'Waiting for Editor') badgeClass = 'badge-review';
    else if (s === 'Submitted for Review' || s === 'PENDING_VERIFICATION' || s === 'Payment Submitted') badgeClass = 'badge-review';
    else if (s === 'Approved' || s === 'Completed' || s === 'PAID') badgeClass = 'badge-approved';
    else if (s === 'Revision Required' || s === 'Revision Requested') badgeClass = 'badge-revision';
    else if (s === 'PARTIALLY_PAID') badgeClass = 'badge-partial';
    else if (s === 'Cancelled' || s === 'UNPAID' || s === 'REJECTED') badgeClass = 'badge-cancelled';

    return `<span class="badge ${badgeClass}">${s === 'PENDING_VERIFICATION' ? 'Verification Pending' : s}</span>`;
  }
};

window.State = State;

