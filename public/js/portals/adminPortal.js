/**
 * Admin Portal View Controllers
 * Full agency management with privacy mediation, multi-currency finances, and lifecycle control.
 */

const AdminPortal = {
  // ==========================================
  // 1. OVERVIEW DASHBOARD
  // ==========================================
  async renderOverview(container) {
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <div>
          <h1 class="page-title">Agency Command Center</h1>
          <p class="card-subtitle">Real-time operations, multi-currency ledger, and project pipeline.</p>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-primary" onclick="AdminPortal.openCreateProjectModal()">
            <i data-lucide="plus-circle" style="width:16px;height:16px"></i> New Project
          </button>
          <button class="btn btn-secondary" onclick="AdminPortal.openRecordPaymentModal()">
            <i data-lucide="credit-card" style="width:16px;height:16px"></i> Record Payment
          </button>
        </div>
      </div>

      <!-- Quick Financial Summary Bar -->
      <div id="admin-financial-snapshot"></div>

      <!-- Operational Metrics Grid -->
      <div id="admin-stats-grid" class="stats-grid"></div>

      <!-- Action Required: Pending Client Requests -->
      <div class="card" id="admin-pending-queue-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Pending Client Quote Requests</h2>
            <p class="card-subtitle">Requires budget review, pricing agreement, and editor allocation.</p>
          </div>
          <span class="badge badge-pending" id="pending-count-badge">0 Pending</span>
        </div>
        <div id="admin-pending-queue-body"></div>
      </div>

      <!-- Active Projects & Upcoming Deadlines -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Active Project Deliveries</h2>
            <p class="card-subtitle">Track cuts in progress and upcoming submission milestones.</p>
          </div>
          <a href="#projects" class="btn btn-sm btn-outline">View All Projects</a>
        </div>
        <div id="admin-active-pipeline-body"></div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Load data
    await this.loadOverviewData();
  },

  async loadOverviewData() {
    try {
      const [projRes, finRes, clientRes, editorRes] = await Promise.all([
        API.get('/projects'),
        API.get('/finance/overview'),
        API.get('/users/clients'),
        API.get('/users/editors')
      ]);

      const projects = projRes.projects || [];
      const stats = finRes.stats || { USD: {}, INR: {} };
      const clients = clientRes.clients || [];
      const editors = editorRes.editors || [];

      // Render Financial Snapshot Card
      const finContainer = document.getElementById('admin-financial-snapshot');
      if (finContainer) {
        finContainer.innerHTML = `
          <div class="card" style="background:linear-gradient(135deg, rgba(37,99,235,0.06), rgba(124,58,237,0.06));border-color:rgba(37,99,235,0.25)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
              <div style="display:flex;align-items:center;gap:8px">
                <i data-lucide="wallet" style="color:var(--accent-primary);width:20px;height:20px"></i>
                <h3 style="font-size:1.05rem;font-weight:700">Financial Snapshot & Realized Agency Profit</h3>
              </div>
              <div style="display:flex;gap:8px">
                <span class="badge badge-approved" style="font-size:0.8rem">USD ($) & INR (₹) Dual Ledger</span>
              </div>
            </div>
            
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px">
              <div style="padding:14px;background-color:var(--bg-card);border-radius:var(--radius-lg);border:1px solid var(--border-color)">
                <div class="stat-title">Realized Profit (USD)</div>
                <div style="font-size:1.45rem;font-weight:800;color:var(--accent-success)">
                  $${(stats.USD.realized_profit || 0).toLocaleString()}
                </div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">
                  Received: $${(stats.USD.client_payments_received || 0).toLocaleString()} | Paid: $${(stats.USD.editor_payments_made || 0).toLocaleString()}
                </div>
              </div>

              <div style="padding:14px;background-color:var(--bg-card);border-radius:var(--radius-lg);border:1px solid var(--border-color)">
                <div class="stat-title">Realized Profit (INR)</div>
                <div style="font-size:1.45rem;font-weight:800;color:var(--accent-success)">
                  ₹${(stats.INR.realized_profit || 0).toLocaleString()}
                </div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">
                  Received: ₹${(stats.INR.client_payments_received || 0).toLocaleString()} | Paid: ₹${(stats.INR.editor_payments_made || 0).toLocaleString()}
                </div>
              </div>

              <div style="padding:14px;background-color:var(--bg-card);border-radius:var(--radius-lg);border:1px solid var(--border-color)">
                <div class="stat-title">Outstanding Client Receivables</div>
                <div style="font-size:1.3rem;font-weight:700;color:var(--accent-warning)">
                  $${(stats.USD.outstanding_client_receivables || 0).toLocaleString()} / ₹${(stats.INR.outstanding_client_receivables || 0).toLocaleString()}
                </div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">Pending client payments</div>
              </div>

              <div style="padding:14px;background-color:var(--bg-card);border-radius:var(--radius-lg);border:1px solid var(--border-color)">
                <div class="stat-title">Outstanding Editor Payables</div>
                <div style="font-size:1.3rem;font-weight:700;color:var(--accent-info)">
                  $${(stats.USD.outstanding_editor_payables || 0).toLocaleString()} / ₹${(stats.INR.outstanding_editor_payables || 0).toLocaleString()}
                </div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">Pending editor payouts</div>
              </div>
            </div>
          </div>
        `;
      }

      // Operational Metrics
      const activeCount = projects.filter(p => !['Completed', 'Cancelled', 'Pending Approval'].includes(p.status)).length;
      const completedCount = projects.filter(p => p.status === 'Completed').length;
      const pendingRequests = projects.filter(p => p.status === 'Pending Approval');
      const submittedReviews = projects.filter(p => p.status === 'Submitted for Review');

      const statsGrid = document.getElementById('admin-stats-grid');
      if (statsGrid) {
        statsGrid.innerHTML = `
          <div class="stat-card">
            <div>
              <div class="stat-title">Active Clients</div>
              <div class="stat-value">${clients.filter(c => c.status === 'ACTIVE').length}</div>
              <div class="stat-meta">Total accounts: ${clients.length}</div>
            </div>
            <div class="stat-icon icon-blue"><i data-lucide="users"></i></div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Active Editors</div>
              <div class="stat-value">${editors.filter(e => e.status === 'ACTIVE').length}</div>
              <div class="stat-meta">Roster capacity: ${editors.length}</div>
            </div>
            <div class="stat-icon icon-purple"><i data-lucide="film"></i></div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">In-Flight Projects</div>
              <div class="stat-value">${activeCount}</div>
              <div class="stat-meta">Under active edit</div>
            </div>
            <div class="stat-icon icon-amber"><i data-lucide="play-circle"></i></div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Cuts Awaiting Review</div>
              <div class="stat-value">${submittedReviews.length}</div>
              <div class="stat-meta">Submitted by editors</div>
            </div>
            <div class="stat-icon icon-green"><i data-lucide="check-circle-2"></i></div>
          </div>
        `;
      }

      // Pending Queue
      const pendingBadge = document.getElementById('pending-count-badge');
      if (pendingBadge) pendingBadge.textContent = `${pendingRequests.length} Pending`;

      const pendingBody = document.getElementById('admin-pending-queue-body');
      if (pendingBody) {
        if (pendingRequests.length === 0) {
          pendingBody.innerHTML = `
            <div style="text-align:center;padding:32px;color:var(--text-muted)">
              <i data-lucide="check-circle" style="width:36px;height:36px;margin-bottom:8px"></i>
              <p>All client project requests have been reviewed and quoted.</p>
            </div>
          `;
        } else {
          pendingBody.innerHTML = `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Client (Private)</th>
                    <th>Video Type</th>
                    <th>Proposed Budget</th>
                    <th>Requested Deadline</th>
                    <th style="text-align:right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${pendingRequests.map(p => `
                    <tr>
                      <td>
                        <div style="font-weight:700">${p.title}</div>
                        <span style="font-size:0.75rem;color:var(--text-muted)">${p.project_code}</span>
                      </td>
                      <td>
                        <div style="font-weight:600">${p.client_name || 'Client'}</div>
                        <div style="font-size:0.75rem;color:var(--text-muted)">${p.client_company || p.client_email || ''}</div>
                      </td>
                      <td>${p.video_type}</td>
                      <td>
                        <span style="font-weight:700;color:var(--accent-primary)">
                          ${State.formatCurrency(p.client_budget, p.currency)}
                        </span>
                      </td>
                      <td>${State.formatDate(p.deadline)}</td>
                      <td style="text-align:right">
                        <button class="btn btn-sm btn-primary" onclick="AdminPortal.openReviewQuoteModal('${p.id}')">
                          <i data-lucide="edit-3" style="width:14px;height:14px"></i> Review & Quote
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        }
      }

      // Active Pipeline Table
      const activePipeline = document.getElementById('admin-active-pipeline-body');
      if (activePipeline) {
        const activeList = projects.filter(p => !['Completed', 'Cancelled'].includes(p.status)).slice(0, 8);
        if (activeList.length === 0) {
          activePipeline.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-muted)">No active projects currently in production.</div>`;
        } else {
          activePipeline.innerHTML = `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Project</th>
                    <th>Client</th>
                    <th>Assigned Editor</th>
                    <th>Status</th>
                    <th>Client Price</th>
                    <th>Editor Pay</th>
                    <th>Deadline</th>
                    <th style="text-align:right">Manage</th>
                  </tr>
                </thead>
                <tbody>
                  ${activeList.map(p => `
                    <tr>
                      <td style="font-weight:700">${p.project_code}</td>
                      <td>
                        <div style="font-weight:600">${p.title}</div>
                        <div style="font-size:0.75rem;color:var(--text-muted)">${p.video_type}</div>
                      </td>
                      <td>${p.client_name || '—'}</td>
                      <td>
                        ${p.editor_name ? `<span style="font-weight:600;color:var(--accent-secondary)">${p.editor_name}</span>` : `<span style="color:var(--text-muted)">Unassigned</span>`}
                      </td>
                      <td>${State.getStatusBadge(p.status)}</td>
                      <td><strong>${State.formatCurrency(p.client_price, p.currency)}</strong></td>
                      <td><span style="color:var(--text-secondary)">${State.formatCurrency(p.editor_payment, p.currency)}</span></td>
                      <td>${State.formatDate(p.deadline)}</td>
                      <td style="text-align:right">
                        <button class="btn btn-sm btn-outline" onclick="AdminPortal.openProjectDetailsModal('${p.id}')">
                          Details
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        }
      }

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error('Error loading admin overview:', err);
    }
  },

  // ==========================================
  // 2. PROJECT LIFECYCLE MANAGEMENT
  // ==========================================
  async renderProjects(container) {
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div>
          <h1 class="page-title">Project Lifecycle Management</h1>
          <p class="card-subtitle">Complete control over video production, quotes, editor cuts, and deliveries.</p>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-primary" onclick="AdminPortal.openCreateProjectModal()">
            <i data-lucide="plus" style="width:16px;height:16px"></i> Create Project
          </button>
        </div>
      </div>

      <!-- Filters Bar -->
      <div class="card" style="padding:16px 20px;margin-bottom:20px">
        <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
          <div style="flex:1;min-width:240px">
            <input type="text" id="admin-proj-search" class="form-control" placeholder="Search by title, project code, or video type..." oninput="AdminPortal.filterProjects()">
          </div>
          <div style="width:180px">
            <select id="admin-proj-status-filter" class="form-control" onchange="AdminPortal.filterProjects()">
              <option value="ALL">All Statuses</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Submitted for Review">Submitted for Review</option>
              <option value="Revision Required">Revision Required</option>
              <option value="Approved">Approved</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div style="width:140px">
            <select id="admin-proj-curr-filter" class="form-control" onchange="AdminPortal.filterProjects()">
              <option value="ALL">All Currencies</option>
              <option value="USD">USD ($)</option>
              <option value="INR">INR (₹)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Projects Table Card -->
      <div class="card">
        <div id="admin-projects-table-wrap">
          <div style="text-align:center;padding:40px;color:var(--text-muted)">Loading project pipeline...</div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    await this.fetchAndRenderProjectsTable();
  },

  async fetchAndRenderProjectsTable() {
    try {
      const search = document.getElementById('admin-proj-search')?.value || '';
      const status = document.getElementById('admin-proj-status-filter')?.value || 'ALL';
      const currency = document.getElementById('admin-proj-curr-filter')?.value || 'ALL';

      const res = await API.get('/projects', { search, status, currency });
      State.projects = res.projects || [];

      const wrap = document.getElementById('admin-projects-table-wrap');
      if (!wrap) return;

      if (State.projects.length === 0) {
        wrap.innerHTML = `
          <div style="text-align:center;padding:48px;color:var(--text-muted)">
            <i data-lucide="inbox" style="width:40px;height:40px;margin-bottom:10px"></i>
            <p>No projects match the selected filters.</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      wrap.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Project Title</th>
                <th>Client</th>
                <th>Editor</th>
                <th>Status</th>
                <th>Client Price</th>
                <th>Editor Payout</th>
                <th>Net Margin</th>
                <th>Deadline</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${State.projects.map(p => {
                const margin = p.net_margin !== undefined ? p.net_margin : (p.client_price - p.editor_payment);
                const marginPct = p.client_price > 0 ? ((margin / p.client_price) * 100).toFixed(0) : 0;
                return `
                  <tr>
                    <td style="font-weight:700">${p.project_code}</td>
                    <td>
                      <div style="font-weight:600">${p.title}</div>
                      <div style="font-size:0.75rem;color:var(--text-muted)">${p.video_type}</div>
                    </td>
                    <td>
                      <div>${p.client_name || '—'}</div>
                      <div style="font-size:0.75rem;color:var(--text-muted)">${p.client_company || ''}</div>
                    </td>
                    <td>
                      ${p.editor_name ? `<span style="font-weight:600;color:var(--accent-secondary)">${p.editor_name}</span>` : `<span style="color:var(--text-muted);font-style:italic">Unassigned</span>`}
                    </td>
                    <td>${State.getStatusBadge(p.status)}</td>
                    <td>
                      <strong>${State.formatCurrency(p.client_price, p.currency)}</strong>
                      <div style="font-size:0.72rem;color:var(--text-muted)">${State.getStatusBadge(p.client_payment_status)}</div>
                    </td>
                    <td>
                      <span>${State.formatCurrency(p.editor_payment, p.currency)}</span>
                      <div style="font-size:0.72rem;color:var(--text-muted)">${State.getStatusBadge(p.editor_payment_status)}</div>
                    </td>
                    <td>
                      <span style="font-weight:700;color:${margin >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}">
                        ${State.formatCurrency(margin, p.currency)} (${marginPct}%)
                      </span>
                    </td>
                    <td>${State.formatDate(p.deadline)}</td>
                    <td style="text-align:right">
                      <div style="display:flex;gap:6px;justify-content:flex-end">
                        <button class="btn btn-sm btn-outline" onclick="AdminPortal.openProjectDetailsModal('${p.id}')" title="Details">
                          <i data-lucide="eye" style="width:14px;height:14px"></i>
                        </button>
                        ${p.status === 'Pending Approval' ? `
                          <button class="btn btn-sm btn-primary" onclick="AdminPortal.openReviewQuoteModal('${p.id}')">
                            Quote
                          </button>
                        ` : ''}
                        ${p.status === 'Submitted for Review' ? `
                          <button class="btn btn-sm btn-success" onclick="AdminPortal.openReviewCutModal('${p.id}')">
                            Review Cut
                          </button>
                        ` : ''}
                        ${p.status === 'Approved' ? `
                          <button class="btn btn-sm btn-primary" onclick="AdminPortal.openCompleteProjectModal('${p.id}')">
                            Deliver
                          </button>
                        ` : ''}
                        <button class="btn btn-sm btn-outline" style="color:var(--accent-danger);border-color:rgba(239,68,68,0.25)" onclick="AdminPortal.confirmDeleteProject('${p.id}', '${p.project_code}')" title="Delete Project">
                          <i data-lucide="trash-2" style="width:14px;height:14px"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  },

  filterProjects() {
    this.fetchAndRenderProjectsTable();
  },

  // ==========================================
  // REVIEW & QUOTE MODAL (MULTI-CURRENCY)
  // ==========================================
  async openReviewQuoteModal(projectId) {
    try {
      const [projData, editorData] = await Promise.all([
        API.get(`/projects/${projectId}`),
        API.get('/users/editors')
      ]);

      const project = projData.project;
      const editors = editorData.editors || [];
      const curr = project.currency || 'USD';
      const currSymbol = curr === 'INR' ? '₹' : '$';

      Modal.open({
        title: `Review Quote & Assign Editor: ${project.project_code}`,
        size: 'lg',
        bodyHtml: `
          <div style="margin-bottom:18px;padding:14px;border-radius:var(--radius-md);background-color:var(--bg-tertiary);border:1px solid var(--border-color)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <h4 style="font-weight:700;font-size:1.05rem">${project.title}</h4>
                <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:2px">
                  Video Type: <strong>${project.video_type}</strong> | Client: <strong>${project.client_name} (${project.client_company || ''})</strong>
                </div>
              </div>
              <div style="text-align:right">
                <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;font-weight:700">Client Proposed Budget</div>
                <div style="font-size:1.4rem;font-weight:800;color:var(--accent-primary)">
                  ${State.formatCurrency(project.client_budget, curr)}
                </div>
              </div>
            </div>
            
            ${project.reference_link ? `
              <div style="margin-top:10px;font-size:0.85rem">
                <strong>Raw Footage Drive:</strong> 
                <a href="${project.reference_link}" target="_blank" style="color:var(--accent-primary);text-decoration:underline">
                  ${project.reference_link}
                </a>
              </div>
            ` : ''}

            ${project.spec_doc_url ? `
              <div style="margin-top:4px;font-size:0.85rem">
                <strong>Spec / Brief Document:</strong> 
                <a href="${project.spec_doc_url}" target="_blank" style="color:var(--accent-primary);text-decoration:underline">
                  ${project.spec_doc_url}
                </a>
              </div>
            ` : ''}

            ${project.editing_requirements ? `
              <div style="margin-top:8px;font-size:0.85rem;background:var(--bg-card);padding:10px;border-radius:var(--radius-sm)">
                <strong>Client Instructions:</strong> ${project.editing_requirements}
              </div>
            ` : ''}
          </div>

          <form id="quote-form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Negotiated Client Price (${currSymbol} ${curr})</label>
                <input type="number" step="0.01" id="quote-client-price" class="form-control" value="${project.client_price > 0 ? project.client_price : (project.client_budget || 0)}" required>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">Client will see this price in their portal.</div>
              </div>

              <div class="form-group">
                <label class="form-label">Assign Video Editor</label>
                <select id="quote-editor-id" class="form-control" required>
                  <option value="">Select Editor from Roster...</option>
                  ${editors.filter(e => e.status === 'ACTIVE').map(e => `
                    <option value="${e.id}" ${project.editor_id === e.id ? 'selected' : ''}>
                      ${e.name} (${e.skills ? e.skills.substring(0, 30) + '...' : 'Available'})
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Agreed Editor Payout (${currSymbol} ${curr})</label>
                <input type="number" step="0.01" id="quote-editor-payment" class="form-control" value="${project.editor_payment || 0}" required>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">Strictly hidden from client. Editor only sees this amount.</div>
              </div>

              <div class="form-group">
                <label class="form-label">Confirmed Delivery Deadline</label>
                <input type="date" id="quote-deadline" class="form-control" value="${project.deadline ? project.deadline.substring(0, 10) : ''}">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Admin Quote / Negotiation Note for Client (Optional)</label>
              <textarea id="quote-admin-note" class="form-control" placeholder="e.g. Quoted rate accepts proposed scope; includes 2 revision rounds and 4K color grade.">${project.admin_quote_note || ''}</textarea>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">Visible to client alongside their quoted price. Never seen by editors.</div>
            </div>

            <!-- Profit Margin Live Preview -->
            <div id="quote-margin-preview" style="padding:12px;background:rgba(16,185,129,0.1);border-radius:var(--radius-md);border:1px solid rgba(16,185,129,0.2);margin-top:10px;font-size:0.88rem;display:flex;justify-content:space-between">
              <span>Projected Agency Margin:</span>
              <strong id="quote-margin-val" style="color:var(--accent-success)">—</strong>
            </div>
          </form>
        `,
        footerHtml: `
          <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary" onclick="AdminPortal.submitReviewQuote('${project.id}')">
            Confirm Quote & Assign Editor
          </button>
        `,
        onRender: () => {
          const updateMargin = () => {
            const cp = parseFloat(document.getElementById('quote-client-price')?.value || 0);
            const ep = parseFloat(document.getElementById('quote-editor-payment')?.value || 0);
            const margin = cp - ep;
            const pct = cp > 0 ? ((margin / cp) * 100).toFixed(1) : 0;
            const el = document.getElementById('quote-margin-val');
            if (el) el.textContent = `${State.formatCurrency(margin, curr)} (${pct}%)`;
          };

          document.getElementById('quote-client-price')?.addEventListener('input', updateMargin);
          document.getElementById('quote-editor-payment')?.addEventListener('input', updateMargin);
          updateMargin();
        }
      });
    } catch (err) {
      console.error(err);
    }
  },

  async submitReviewQuote(projectId) {
    try {
      const client_price = parseFloat(document.getElementById('quote-client-price')?.value || 0);
      const editor_id = document.getElementById('quote-editor-id')?.value;
      const editor_payment = parseFloat(document.getElementById('quote-editor-payment')?.value || 0);
      const deadline = document.getElementById('quote-deadline')?.value;
      const admin_quote_note = document.getElementById('quote-admin-note')?.value;

      if (!editor_id) {
        Toast.error('Please assign an editor to this project.');
        return;
      }

      await API.post(`/projects/${projectId}/quote`, {
        client_price,
        editor_id,
        editor_payment,
        deadline,
        admin_quote_note,
        status: 'In Progress'
      });

      Toast.success('Quote confirmed, editor assigned, and notifications dispatched!');
      Modal.close();
      this.fetchAndRenderProjectsTable();
    } catch (err) {
      console.error(err);
    }
  },

  // ==========================================
  // REVIEW CUT MODAL (ADMIN QUALITY CHECK)
  // ==========================================
  async openReviewCutModal(projectId) {
    try {
      const data = await API.get(`/projects/${projectId}`);
      const project = data.project;
      const submissions = data.submissions || [];
      const latestSub = submissions[0];

      Modal.open({
        title: `Review Editor Cut: ${project.project_code}`,
        size: 'lg',
        bodyHtml: `
          <div style="margin-bottom:20px;padding:16px;border-radius:var(--radius-lg);background:var(--bg-tertiary);border:1px solid var(--border-color)">
            <h4 style="font-weight:700">${project.title}</h4>
            <div style="font-size:0.85rem;color:var(--text-muted);margin-top:2px">Assigned Editor: <strong>${project.editor_name}</strong></div>

            ${latestSub ? `
              <div style="margin-top:14px;padding:12px;background:var(--bg-card);border-radius:var(--radius-md);border:1px solid var(--border-color)">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <strong style="color:var(--accent-primary)">Cut Version ${latestSub.version}</strong>
                  <span style="font-size:0.75rem;color:var(--text-muted)">Submitted: ${State.formatDateTime(latestSub.created_at)}</span>
                </div>
                <div style="margin-top:8px">
                  <a href="${latestSub.submission_link}" target="_blank" class="btn btn-sm btn-primary" style="display:inline-flex">
                    <i data-lucide="external-link" style="width:14px;height:14px"></i> Open Drive / Preview Cut
                  </a>
                </div>
                ${latestSub.notes ? `
                  <div style="margin-top:10px;font-size:0.88rem;color:var(--text-secondary)">
                    <strong>Editor Notes:</strong> ${latestSub.notes}
                  </div>
                ` : ''}
              </div>
            ` : `
              <p style="margin-top:10px;color:var(--text-muted)">No cut files uploaded yet.</p>
            `}
          </div>

          <div class="form-group">
            <label class="form-label">Revision Instructions / Quality Review Feedback</label>
            <textarea id="cut-review-notes" class="form-control" placeholder="If requesting revisions, specify exact timestamps, audio adjustments, or grading changes needed..."></textarea>
          </div>
        `,
        footerHtml: `
          <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-danger" onclick="AdminPortal.submitCutReview('${project.id}', '${latestSub ? latestSub.id : ''}', 'REQUEST_REVISION')">
            Request Revision
          </button>
          <button class="btn btn-success" onclick="AdminPortal.submitCutReview('${project.id}', '${latestSub ? latestSub.id : ''}', 'APPROVE')">
            Approve Cut
          </button>
        `
      });
    } catch (err) {
      console.error(err);
    }
  },

  async submitCutReview(projectId, submissionId, action) {
    try {
      const notes = document.getElementById('cut-review-notes')?.value;

      if (action === 'REQUEST_REVISION' && !notes) {
        Toast.error('Please provide revision instructions for the editor.');
        return;
      }

      await API.post(`/projects/${projectId}/review-cut`, {
        submission_id: submissionId,
        action,
        notes
      });

      Toast.success(action === 'APPROVE' ? 'Cut approved! Project ready for client delivery.' : 'Revision requested from editor.');
      Modal.close();
      this.fetchAndRenderProjectsTable();
    } catch (err) {
      console.error(err);
    }
  },

  // ==========================================
  // COMPLETE & DELIVER MODAL
  // ==========================================
  async openCompleteProjectModal(projectId) {
    try {
      const data = await API.get(`/projects/${projectId}`);
      const project = data.project;

      Modal.open({
        title: `Deliver Final Master: ${project.project_code}`,
        bodyHtml: `
          <p style="font-size:0.9rem;color:var(--text-secondary);margin-bottom:16px">
            Deliver the master video package to <strong>${project.client_name}</strong>. This marks the project completed and enables the client to download their final renders.
          </p>
          <div class="form-group">
            <label class="form-label">Final Delivery Master Link (Google Drive / Dropbox)</label>
            <input type="url" id="delivery-link" class="form-control" placeholder="https://drive.google.com/drive/folders/..." value="${project.final_delivery_link || ''}" required>
          </div>
        `,
        footerHtml: `
          <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary" onclick="AdminPortal.submitCompleteProject('${project.id}')">
            Deliver & Mark Completed
          </button>
        `
      });
    } catch (err) {
      console.error(err);
    }
  },

  async submitCompleteProject(projectId) {
    try {
      const final_delivery_link = document.getElementById('delivery-link')?.value;
      if (!final_delivery_link) {
        Toast.error('Please enter the final delivery link.');
        return;
      }

      await API.post(`/projects/${projectId}/complete`, { final_delivery_link });
      Toast.success('Project marked completed and master link delivered to client!');
      Modal.close();
      this.fetchAndRenderProjectsTable();
    } catch (err) {
      console.error(err);
    }
  },

  // ==========================================
  // CREATE PROJECT DIRECTLY (ADMIN)
  // ==========================================
  async openCreateProjectModal() {
    try {
      const [clientData, editorData] = await Promise.all([
        API.get('/users/clients'),
        API.get('/users/editors')
      ]);

      const clients = clientData.clients || [];
      const editors = editorData.editors || [];

      Modal.open({
        title: 'Create Direct Agency Project',
        size: 'lg',
        bodyHtml: `
          <form id="create-project-admin-form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Select Client *</label>
                <select id="new-proj-client" class="form-control" required>
                  <option value="">Choose client...</option>
                  ${clients.map(c => `<option value="${c.id}">${c.name} (${c.company_name || c.email})</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Video Type *</label>
                <select id="new-proj-type" class="form-control" required>
                  <option value="YouTube Explainer">YouTube Explainer</option>
                  <option value="Reels / TikTok">Reels / TikTok (Vertical)</option>
                  <option value="SaaS Showcase">SaaS Showcase</option>
                  <option value="Commercial">Commercial / Brand Film</option>
                  <option value="Documentary">Documentary</option>
                  <option value="Podcast">Podcast Video Edit</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Project Title *</label>
              <input type="text" id="new-proj-title" class="form-control" placeholder="e.g. Autumn Brand Launch Commercial" required>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Currency *</label>
                <select id="new-proj-currency" class="form-control">
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Client Quoted Price *</label>
                <input type="number" step="0.01" id="new-proj-client-price" class="form-control" placeholder="0.00" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Assign Editor (Optional)</label>
                <select id="new-proj-editor" class="form-control">
                  <option value="">Unassigned</option>
                  ${editors.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Agreed Editor Payout</label>
                <input type="number" step="0.01" id="new-proj-editor-payment" class="form-control" placeholder="0.00">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Raw Footage Link</label>
                <input type="url" id="new-proj-footage" class="form-control" placeholder="https://drive.google.com/...">
              </div>

              <div class="form-group">
                <label class="form-label">Delivery Deadline</label>
                <input type="date" id="new-proj-deadline" class="form-control">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Editing Brief & Instructions</label>
              <textarea id="new-proj-desc" class="form-control" placeholder="Detailed cutting requirements, pacing, sound design, grading..."></textarea>
            </div>
          </form>
        `,
        footerHtml: `
          <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary" onclick="AdminPortal.submitCreateProject()">Create Project</button>
        `
      });
    } catch (err) {
      console.error(err);
    }
  },

  async submitCreateProject() {
    try {
      const client_id = document.getElementById('new-proj-client')?.value;
      const title = document.getElementById('new-proj-title')?.value;
      const video_type = document.getElementById('new-proj-type')?.value;
      const currency = document.getElementById('new-proj-currency')?.value;
      const client_price = parseFloat(document.getElementById('new-proj-client-price')?.value || 0);
      const editor_id = document.getElementById('new-proj-editor')?.value || null;
      const editor_payment = parseFloat(document.getElementById('new-proj-editor-payment')?.value || 0);
      const reference_link = document.getElementById('new-proj-footage')?.value;
      const deadline = document.getElementById('new-proj-deadline')?.value;
      const description = document.getElementById('new-proj-desc')?.value;

      if (!client_id || !title || !video_type) {
        Toast.error('Please complete all required fields.');
        return;
      }

      await API.post('/projects', {
        client_id,
        title,
        video_type,
        currency,
        client_price,
        editor_id,
        editor_payment,
        reference_link,
        deadline,
        description,
        status: editor_id ? 'In Progress' : 'Assigned'
      });

      Toast.success('Project created and configured successfully!');
      Modal.close();
      this.fetchAndRenderProjectsTable();
    } catch (err) {
      console.error(err);
    }
  },

  // ==========================================
  // PROJECT DETAILS MODAL
  // ==========================================
  async openProjectDetailsModal(projectId) {
    try {
      const data = await API.get(`/projects/${projectId}`);
      const p = data.project;
      const submissions = data.submissions || [];
      const payments = data.payments || [];
      const curr = p.currency || 'USD';

      Modal.open({
        title: `${p.project_code}: ${p.title}`,
        size: 'lg',
        bodyHtml: `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div>
              <span style="font-size:0.85rem;color:var(--text-muted)">Video Type:</span> 
              <strong>${p.video_type}</strong>
            </div>
            <div>${State.getStatusBadge(p.status)}</div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
            <div style="padding:12px;background:var(--bg-tertiary);border-radius:var(--radius-md)">
              <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;font-weight:700">Client Information</div>
              <div style="font-weight:700;margin-top:2px">${p.client_name || '—'}</div>
              <div style="font-size:0.82rem;color:var(--text-secondary)">${p.client_company || ''} | ${p.client_email || ''}</div>
              <div style="margin-top:6px;font-size:0.85rem">
                Quoted: <strong>${State.formatCurrency(p.client_price, curr)}</strong> | 
                Paid: <strong style="color:var(--accent-success)">${State.formatCurrency(p.client_paid_amount, curr)}</strong>
              </div>
            </div>

            <div style="padding:12px;background:var(--bg-tertiary);border-radius:var(--radius-md)">
              <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;font-weight:700">Assigned Editor</div>
              <div style="font-weight:700;margin-top:2px">${p.editor_name || 'Unassigned'}</div>
              <div style="font-size:0.82rem;color:var(--text-secondary)">${p.editor_email || ''}</div>
              <div style="margin-top:6px;font-size:0.85rem">
                Agreed Payout: <strong>${State.formatCurrency(p.editor_payment, curr)}</strong> | 
                Paid: <strong style="color:var(--accent-success)">${State.formatCurrency(p.editor_paid_amount, curr)}</strong>
              </div>
            </div>
          </div>

          ${p.reference_link ? `
            <div style="margin-bottom:10px;font-size:0.88rem">
              <strong>Raw Footage Link:</strong> 
              <a href="${p.reference_link}" target="_blank" style="color:var(--accent-primary);text-decoration:underline">${p.reference_link}</a>
            </div>
          ` : ''}

          ${p.final_delivery_link ? `
            <div style="margin-bottom:10px;font-size:0.88rem;background:rgba(16,185,129,0.1);padding:10px;border-radius:var(--radius-sm)">
              <strong style="color:var(--accent-success)">Final Master Download:</strong> 
              <a href="${p.final_delivery_link}" target="_blank" style="color:var(--accent-primary);text-decoration:underline">${p.final_delivery_link}</a>
            </div>
          ` : ''}

          <!-- Cut Submissions History -->
          <div style="margin-top:16px">
            <h4 style="font-size:0.95rem;font-weight:700;margin-bottom:8px">Cut Submissions (${submissions.length})</h4>
            ${submissions.length === 0 ? `<p style="font-size:0.85rem;color:var(--text-muted)">No cuts submitted yet.</p>` : `
              <div style="display:flex;flex-direction:column;gap:8px">
                ${submissions.map(s => `
                  <div style="padding:10px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);display:flex;justify-content:space-between;align-items:center">
                    <div>
                      <strong>Version ${s.version}</strong> - <span style="font-size:0.8rem;color:var(--text-muted)">${State.formatDateTime(s.created_at)}</span>
                      <div style="font-size:0.82rem;color:var(--text-secondary);margin-top:2px">${s.notes || 'No note'}</div>
                    </div>
                    <div>
                      <a href="${s.submission_link}" target="_blank" class="btn btn-sm btn-outline">Preview Link</a>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        `,
        footerHtml: `<button class="btn btn-secondary" onclick="Modal.close()">Close</button>`
      });
    } catch (err) {
      console.error(err);
    }
  },

  confirmDeleteProject(projectId, projectCode) {
    Modal.open({
      title: 'Delete Project',
      bodyHtml: `
        <div style="padding:10px 0">
          <p style="font-size:0.95rem;margin-bottom:12px">
            Are you sure you want to permanently delete project <strong>${projectCode}</strong>?
          </p>
          <p style="font-size:0.85rem;color:var(--text-muted)">
            All associated cuts, submissions, and payments will be permanently removed.
          </p>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-danger" onclick="AdminPortal.deleteProject('${projectId}')">
          <i data-lucide="trash-2" style="width:14px;height:14px"></i> Yes, Delete Project
        </button>
      `
    });
    if (window.lucide) window.lucide.createIcons();
  },

  async deleteProject(projectId) {
    try {
      await API.delete(`/projects/${projectId}`);
      Toast.success('Project deleted successfully.');
      Modal.close();
      await this.fetchAndRenderProjectsTable();
    } catch (err) {
      console.error(err);
      Toast.error(err.message || 'Failed to delete project.');
    }
  },

  // ==========================================
  // 3. CLIENT MANAGEMENT
  // ==========================================
  async renderClients(container) {
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div>
          <h1 class="page-title">Client Roster & Profiles</h1>
          <p class="card-subtitle">Manage client accounts, companies, contact details, and project history.</p>
        </div>
        <button class="btn btn-primary" onclick="AdminPortal.openAddClientModal()">
          <i data-lucide="user-plus" style="width:16px;height:16px"></i> Add New Client
        </button>
      </div>

      <div class="card">
        <div id="admin-clients-table-wrap">Loading clients...</div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    await this.fetchAndRenderClients();
  },

  async fetchAndRenderClients() {
    try {
      const res = await API.get('/users/clients');
      const clients = res.clients || [];

      const wrap = document.getElementById('admin-clients-table-wrap');
      if (!wrap) return;

      if (clients.length === 0) {
        wrap.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">No clients registered yet.</div>`;
        return;
      }

      wrap.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Total Projects</th>
                <th>Status</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${clients.map(c => `
                <tr>
                  <td style="font-weight:700">${c.name}</td>
                  <td>${c.company_name || '—'}</td>
                  <td>${c.email}</td>
                  <td>${c.phone || '—'}</td>
                  <td><strong>${c.total_projects || 0}</strong></td>
                  <td>
                    <span class="badge ${c.status === 'ACTIVE' ? 'badge-approved' : 'badge-cancelled'}">
                      ${c.status}
                    </span>
                  </td>
                  <td style="text-align:right">
                    <button class="btn btn-sm btn-outline" onclick="AdminPortal.openEditClientModal('${c.id}')">Edit</button>
                    <button class="btn btn-sm ${c.status === 'ACTIVE' ? 'btn-danger' : 'btn-success'}" onclick="AdminPortal.toggleUserStatus('${c.id}')">
                      ${c.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error(err);
    }
  },

  openAddClientModal() {
    Modal.open({
      title: 'Add New Client Account',
      bodyHtml: `
        <form id="add-client-form">
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input type="text" id="add-client-name" class="form-control" placeholder="Marcus Brody" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Email Address *</label>
              <input type="email" id="add-client-email" class="form-control" placeholder="client@company.com" required>
            </div>
            <div class="form-group">
              <label class="form-label">Password *</label>
              <input type="password" id="add-client-password" class="form-control" placeholder="••••••••" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Company / Channel Name</label>
              <input type="text" id="add-client-company" class="form-control" placeholder="TechFlow Media">
            </div>
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input type="text" id="add-client-phone" class="form-control" placeholder="+1 (555) 000-0000">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Internal Client Notes</label>
            <textarea id="add-client-notes" class="form-control" placeholder="Preferences, style guides, release cadence..."></textarea>
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="AdminPortal.submitAddClient()">Create Client</button>
      `
    });
  },

  async submitAddClient() {
    try {
      const name = document.getElementById('add-client-name')?.value;
      const email = document.getElementById('add-client-email')?.value;
      const password = document.getElementById('add-client-password')?.value;
      const company_name = document.getElementById('add-client-company')?.value;
      const phone = document.getElementById('add-client-phone')?.value;
      const notes = document.getElementById('add-client-notes')?.value;

      if (!name || !email || !password) {
        Toast.error('Name, email, and password are required.');
        return;
      }

      await API.post('/users/clients', { name, email, password, company_name, phone, notes });
      Toast.success('Client account created successfully!');
      Modal.close();
      this.fetchAndRenderClients();
    } catch (err) {
      console.error(err);
    }
  },

  async openEditClientModal(clientId) {
    try {
      const data = await API.get(`/users/clients/${clientId}`);
      const c = data.client;

      Modal.open({
        title: `Edit Client: ${c.name}`,
        bodyHtml: `
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" id="edit-client-name" class="form-control" value="${c.name}">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" id="edit-client-email" class="form-control" value="${c.email}">
            </div>
            <div class="form-group">
              <label class="form-label">Reset Password (leave empty to keep)</label>
              <input type="password" id="edit-client-password" class="form-control" placeholder="New password...">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Company Name</label>
              <input type="text" id="edit-client-company" class="form-control" value="${c.company_name || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input type="text" id="edit-client-phone" class="form-control" value="${c.phone || ''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Internal Notes</label>
            <textarea id="edit-client-notes" class="form-control">${c.notes || ''}</textarea>
          </div>
        `,
        footerHtml: `
          <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary" onclick="AdminPortal.submitEditClient('${c.id}')">Save Changes</button>
        `
      });
    } catch (err) {
      console.error(err);
    }
  },

  async submitEditClient(clientId) {
    try {
      const name = document.getElementById('edit-client-name')?.value;
      const email = document.getElementById('edit-client-email')?.value;
      const password = document.getElementById('edit-client-password')?.value || undefined;
      const company_name = document.getElementById('edit-client-company')?.value;
      const phone = document.getElementById('edit-client-phone')?.value;
      const notes = document.getElementById('edit-client-notes')?.value;

      await API.put(`/users/clients/${clientId}`, { name, email, password, company_name, phone, notes });
      Toast.success('Client profile updated!');
      Modal.close();
      this.fetchAndRenderClients();
    } catch (err) {
      console.error(err);
    }
  },

  // ==========================================
  // 4. EDITOR MANAGEMENT
  // ==========================================
  async renderEditors(container) {
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div>
          <h1 class="page-title">Video Editor Roster</h1>
          <p class="card-subtitle">Manage editing talent, skills, portfolio links, base rates, and assignments.</p>
        </div>
        <button class="btn btn-primary" onclick="AdminPortal.openAddEditorModal()">
          <i data-lucide="user-plus" style="width:16px;height:16px"></i> Add New Editor
        </button>
      </div>

      <div class="card">
        <div id="admin-editors-table-wrap">Loading editors...</div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    await this.fetchAndRenderEditors();
  },

  async fetchAndRenderEditors() {
    try {
      const res = await API.get('/users/editors');
      const editors = res.editors || [];

      const wrap = document.getElementById('admin-editors-table-wrap');
      if (!wrap) return;

      if (editors.length === 0) {
        wrap.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">No editors on roster yet.</div>`;
        return;
      }

      wrap.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Editor Name</th>
                <th>Software & Skills</th>
                <th>Experience</th>
                <th>Base Rate ($/hr)</th>
                <th>Active Projects</th>
                <th>Completed</th>
                <th>Status</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${editors.map(e => `
                <tr>
                  <td style="font-weight:700">
                    <div>${e.name}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">${e.email}</div>
                  </td>
                  <td style="max-width:240px">
                    <span style="font-size:0.82rem">${e.skills || 'General Editing'}</span>
                  </td>
                  <td>${e.experience || '—'}</td>
                  <td><strong>$${(e.payment_rate || 0).toFixed(2)}</strong></td>
                  <td><span class="badge badge-progress">${e.active_projects || 0}</span></td>
                  <td>${e.completed_projects || 0}</td>
                  <td>
                    <span class="badge ${e.status === 'ACTIVE' ? 'badge-approved' : 'badge-cancelled'}">
                      ${e.status}
                    </span>
                  </td>
                  <td style="text-align:right">
                    <button class="btn btn-sm btn-outline" onclick="AdminPortal.openEditEditorModal('${e.id}')">Edit</button>
                    <button class="btn btn-sm ${e.status === 'ACTIVE' ? 'btn-danger' : 'btn-success'}" onclick="AdminPortal.toggleUserStatus('${e.id}')">
                      ${e.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error(err);
    }
  },

  openAddEditorModal() {
    Modal.open({
      title: 'Add New Video Editor to Roster',
      size: 'lg',
      bodyHtml: `
        <form id="add-editor-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <input type="text" id="add-editor-name" class="form-control" placeholder="Liam Vance" required>
            </div>
            <div class="form-group">
              <label class="form-label">Email Address *</label>
              <input type="email" id="add-editor-email" class="form-control" placeholder="editor@videoagency.com" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Password *</label>
              <input type="password" id="add-editor-password" class="form-control" placeholder="••••••••" required>
            </div>
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input type="text" id="add-editor-phone" class="form-control" placeholder="+1 (555) 000-0000">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Software Skills & Specialties</label>
            <input type="text" id="add-editor-skills" class="form-control" placeholder="Premiere Pro, DaVinci Resolve, After Effects, Sound Design">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Experience</label>
              <input type="text" id="add-editor-exp" class="form-control" placeholder="5+ Years, Commercial & YouTube">
            </div>
            <div class="form-group">
              <label class="form-label">Base Rate ($/hr or project avg)</label>
              <input type="number" step="0.01" id="add-editor-rate" class="form-control" placeholder="45.00">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Portfolio Link (Vimeo / Behance / Drive)</label>
            <input type="url" id="add-editor-portfolio" class="form-control" placeholder="https://vimeo.com/...">
          </div>
          <div class="form-group">
            <label class="form-label">Internal Notes (Private to Admin)</label>
            <textarea id="add-editor-notes" class="form-control" placeholder="Turnaround speed, reliability, special niche strengths..."></textarea>
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="AdminPortal.submitAddEditor()">Create Editor</button>
      `
    });
  },

  async submitAddEditor() {
    try {
      const name = document.getElementById('add-editor-name')?.value;
      const email = document.getElementById('add-editor-email')?.value;
      const password = document.getElementById('add-editor-password')?.value;
      const phone = document.getElementById('add-editor-phone')?.value;
      const skills = document.getElementById('add-editor-skills')?.value;
      const experience = document.getElementById('add-editor-exp')?.value;
      const payment_rate = parseFloat(document.getElementById('add-editor-rate')?.value || 0);
      const portfolio_link = document.getElementById('add-editor-portfolio')?.value;
      const internal_notes = document.getElementById('add-editor-notes')?.value;

      if (!name || !email || !password) {
        Toast.error('Name, email, and password are required.');
        return;
      }

      await API.post('/users/editors', { name, email, password, phone, skills, experience, payment_rate, portfolio_link, internal_notes });
      Toast.success('Editor profile added to roster!');
      Modal.close();
      this.fetchAndRenderEditors();
    } catch (err) {
      console.error(err);
    }
  },

  async openEditEditorModal(editorId) {
    try {
      const data = await API.get(`/users/editors/${editorId}`);
      const e = data.editor;

      Modal.open({
        title: `Edit Editor: ${e.name}`,
        size: 'lg',
        bodyHtml: `
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input type="text" id="edit-editor-name" class="form-control" value="${e.name}">
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" id="edit-editor-email" class="form-control" value="${e.email}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Reset Password</label>
              <input type="password" id="edit-editor-password" class="form-control" placeholder="New password...">
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input type="text" id="edit-editor-phone" class="form-control" value="${e.phone || ''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Skills & Software</label>
            <input type="text" id="edit-editor-skills" class="form-control" value="${e.skills || ''}">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Experience</label>
              <input type="text" id="edit-editor-exp" class="form-control" value="${e.experience || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Base Rate ($)</label>
              <input type="number" step="0.01" id="edit-editor-rate" class="form-control" value="${e.payment_rate || 0}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Portfolio URL</label>
            <input type="url" id="edit-editor-portfolio" class="form-control" value="${e.portfolio_link || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Internal Notes</label>
            <textarea id="edit-editor-notes" class="form-control">${e.internal_notes || ''}</textarea>
          </div>
        `,
        footerHtml: `
          <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary" onclick="AdminPortal.submitEditEditor('${e.id}')">Save Changes</button>
        `
      });
    } catch (err) {
      console.error(err);
    }
  },

  async submitEditEditor(editorId) {
    try {
      const name = document.getElementById('edit-editor-name')?.value;
      const email = document.getElementById('edit-editor-email')?.value;
      const password = document.getElementById('edit-editor-password')?.value || undefined;
      const phone = document.getElementById('edit-editor-phone')?.value;
      const skills = document.getElementById('edit-editor-skills')?.value;
      const experience = document.getElementById('edit-editor-exp')?.value;
      const payment_rate = parseFloat(document.getElementById('edit-editor-rate')?.value || 0);
      const portfolio_link = document.getElementById('edit-editor-portfolio')?.value;
      const internal_notes = document.getElementById('edit-editor-notes')?.value;

      await API.put(`/users/editors/${editorId}`, { name, email, password, phone, skills, experience, payment_rate, portfolio_link, internal_notes });
      Toast.success('Editor profile updated!');
      Modal.close();
      this.fetchAndRenderEditors();
    } catch (err) {
      console.error(err);
    }
  },

  async toggleUserStatus(userId) {
    try {
      const res = await API.patch(`/users/${userId}/toggle-status`);
      Toast.success(res.message);
      this.fetchAndRenderClients();
      this.fetchAndRenderEditors();
    } catch (err) {
      console.error(err);
    }
  },

  // ==========================================
  // 5. FINANCE & PAYMENT MANAGEMENT
  // ==========================================
  async renderFinance(container) {
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
        <div>
          <h1 class="page-title">Agency Financial Ledger & Payment Reconciliation</h1>
          <p class="card-subtitle">Comprehensive tracking of client billings, editor payouts, net margins, and payment inflow/outflows.</p>
        </div>
        <button class="btn btn-primary" onclick="AdminPortal.openRecordPaymentModal()">
          <i data-lucide="plus" style="width:16px;height:16px"></i> Record Transaction
        </button>
      </div>

      <!-- Financial Formulas & Overview Summary -->
      <div id="admin-finance-overview-cards" style="margin-bottom:24px"></div>

      <!-- Ledger Table -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Project Billing & Payout Ledger</h2>
            <p class="card-subtitle">Auto-calculated balances, payment statuses, and net margins per production.</p>
          </div>
          <div style="display:flex;gap:10px">
            <select id="ledger-curr-filter" class="form-control" style="width:130px" onchange="AdminPortal.loadLedgerData()">
              <option value="ALL">All Currencies</option>
              <option value="USD">USD ($)</option>
              <option value="INR">INR (₹)</option>
            </select>
          </div>
        </div>
        <div id="admin-ledger-table-wrap">Loading financial ledger...</div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    await this.loadLedgerData();
  },

  async loadLedgerData() {
    try {
      const curr = document.getElementById('ledger-curr-filter')?.value || 'ALL';
      const [overRes, ledgRes] = await Promise.all([
        API.get('/finance/overview'),
        API.get('/finance/ledger', { currency: curr })
      ]);

      const stats = overRes.stats || { USD: {}, INR: {} };
      const ledger = ledgRes.ledger || [];

      // Render Overview Cards
      const overviewWrap = document.getElementById('admin-finance-overview-cards');
      if (overviewWrap) {
        overviewWrap.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:20px">
            <!-- USD Box -->
            <div class="card" style="margin-bottom:0;border-left:4px solid var(--accent-primary)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <span style="font-weight:700;font-size:1.05rem">US Dollars ($ USD)</span>
                <span class="badge badge-progress">Global Billing</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:8px;font-size:0.9rem">
                <div style="display:flex;justify-content:space-between">
                  <span style="color:var(--text-muted)">Total Client Inflow:</span>
                  <strong style="color:var(--accent-success)">$${(stats.USD.client_payments_received || 0).toLocaleString()}</strong>
                </div>
                <div style="display:flex;justify-content:space-between">
                  <span style="color:var(--text-muted)">Total Editor Outflow:</span>
                  <strong style="color:var(--accent-danger)">$${(stats.USD.editor_payments_made || 0).toLocaleString()}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px dashed var(--border-color)">
                  <span style="font-weight:600">Realized Agency Profit:</span>
                  <strong style="font-size:1.15rem;color:var(--accent-success)">$${(stats.USD.realized_profit || 0).toLocaleString()}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:var(--text-muted)">
                  <span>Uncollected Receivables:</span>
                  <span>$${(stats.USD.outstanding_client_receivables || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <!-- INR Box -->
            <div class="card" style="margin-bottom:0;border-left:4px solid var(--accent-secondary)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <span style="font-weight:700;font-size:1.05rem">Indian Rupees (₹ INR)</span>
                <span class="badge badge-review">Domestic Billing</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:8px;font-size:0.9rem">
                <div style="display:flex;justify-content:space-between">
                  <span style="color:var(--text-muted)">Total Client Inflow:</span>
                  <strong style="color:var(--accent-success)">₹${(stats.INR.client_payments_received || 0).toLocaleString()}</strong>
                </div>
                <div style="display:flex;justify-content:space-between">
                  <span style="color:var(--text-muted)">Total Editor Outflow:</span>
                  <strong style="color:var(--accent-danger)">₹${(stats.INR.editor_payments_made || 0).toLocaleString()}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px dashed var(--border-color)">
                  <span style="font-weight:600">Realized Agency Profit:</span>
                  <strong style="font-size:1.15rem;color:var(--accent-success)">₹${(stats.INR.realized_profit || 0).toLocaleString()}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:var(--text-muted)">
                  <span>Uncollected Receivables:</span>
                  <span>₹${(stats.INR.outstanding_client_receivables || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      // Render Ledger Table
      const wrap = document.getElementById('admin-ledger-table-wrap');
      if (wrap) {
        if (ledger.length === 0) {
          wrap.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">No ledger records found.</div>`;
          return;
        }

        wrap.innerHTML = `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Project</th>
                  <th>Client Billing</th>
                  <th>Client Paid</th>
                  <th>Client Balance</th>
                  <th>Editor Payout</th>
                  <th>Editor Paid</th>
                  <th>Editor Balance</th>
                  <th>Net Margin</th>
                  <th style="text-align:right">Action</th>
                </tr>
              </thead>
              <tbody>
                ${ledger.map(r => `
                  <tr>
                    <td style="font-weight:700">${r.project_code}</td>
                    <td>
                      <div style="font-weight:600">${r.title}</div>
                      <div style="font-size:0.75rem;color:var(--text-muted)">Client: ${r.client_name || '—'} | Editor: ${r.editor_name || '—'}</div>
                    </td>
                    <td>
                      <div><strong>${State.formatCurrency(r.client_price, r.currency)}</strong></div>
                      <div>${State.getStatusBadge(r.client_payment_status)}</div>
                    </td>
                    <td style="color:var(--accent-success)">
                      ${State.formatCurrency(r.client_paid, r.currency)}
                    </td>
                    <td>
                      <span style="font-weight:600;color:${r.client_balance > 0 ? 'var(--accent-warning)' : 'var(--text-muted)'}">
                        ${State.formatCurrency(r.client_balance, r.currency)}
                      </span>
                    </td>
                    <td>
                      <div><strong>${State.formatCurrency(r.editor_payment, r.currency)}</strong></div>
                      <div>${State.getStatusBadge(r.editor_payment_status)}</div>
                    </td>
                    <td style="color:var(--accent-info)">
                      ${State.formatCurrency(r.editor_paid, r.currency)}
                    </td>
                    <td>
                      <span style="font-weight:600;color:${r.editor_balance > 0 ? 'var(--accent-warning)' : 'var(--text-muted)'}">
                        ${State.formatCurrency(r.editor_balance, r.currency)}
                      </span>
                    </td>
                    <td>
                      <div style="font-weight:700;color:${r.net_margin >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}">
                        ${State.formatCurrency(r.net_margin, r.currency)}
                      </div>
                      <div style="font-size:0.75rem;color:var(--text-muted)">${r.margin_percent}% margin</div>
                    </td>
                    <td style="text-align:right">
                      <button class="btn btn-sm btn-outline" onclick="AdminPortal.openRecordPaymentModal('${r.id}')">
                        Pay / Record
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    } catch (err) {
      console.error(err);
    }
  },

  // ==========================================
  // RECORD PAYMENT MODAL (MULTI-METHOD & CURRENCY)
  // ==========================================
  async openRecordPaymentModal(preselectedProjectId = null) {
    try {
      const projRes = await API.get('/projects');
      const projects = projRes.projects || [];

      Modal.open({
        title: 'Record Financial Transaction',
        size: 'md',
        bodyHtml: `
          <form id="record-payment-form">
            <div class="form-group">
              <label class="form-label">Select Project *</label>
              <select id="pmt-project-id" class="form-control" required onchange="AdminPortal.onPaymentProjectChange(this.value)">
                <option value="">Choose project...</option>
                ${projects.map(p => `
                  <option value="${p.id}" data-currency="${p.currency}" ${preselectedProjectId === p.id ? 'selected' : ''}>
                    ${p.project_code}: ${p.title} (${p.currency})
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Payment Category *</label>
                <select id="pmt-type" class="form-control" required>
                  <option value="CLIENT_PAYMENT">Client Payment (Inflow / Receivable)</option>
                  <option value="EDITOR_PAYMENT">Editor Payout (Outflow / Payable)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Amount *</label>
                <input type="number" step="0.01" id="pmt-amount" class="form-control" placeholder="0.00" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Currency *</label>
                <select id="pmt-currency" class="form-control">
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Payment Method *</label>
                <select id="pmt-method" class="form-control" required>
                  <option value="UPI / GPay / IMPS">UPI / GPay / IMPS (Instant INR)</option>
                  <option value="Bank Wire / ACH">Bank Wire / ACH</option>
                  <option value="Stripe">Stripe</option>
                  <option value="PayPal">PayPal</option>
                  <option value="Wise">Wise</option>
                  <option value="Cash">Cash / Other</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Transaction Reference / UTR ID</label>
                <input type="text" id="pmt-ref" class="form-control" placeholder="e.g. UPI-99482019 or ch_3N1aB...">
              </div>

              <div class="form-group">
                <label class="form-label">Payment Date</label>
                <input type="date" id="pmt-date" class="form-control" value="${new Date().toISOString().substring(0, 10)}">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Notes (Optional)</label>
              <textarea id="pmt-notes" class="form-control" placeholder="e.g. 50% advance deposit or milestone release"></textarea>
            </div>
          </form>
        `,
        footerHtml: `
          <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary" onclick="AdminPortal.submitRecordPayment()">Save Transaction</button>
        `
      });
    } catch (err) {
      console.error(err);
    }
  },

  onPaymentProjectChange(projectId) {
    const select = document.getElementById('pmt-project-id');
    const opt = select.options[select.selectedIndex];
    const curr = opt?.getAttribute('data-currency');
    if (curr) {
      const currSelect = document.getElementById('pmt-currency');
      if (currSelect) currSelect.value = curr;
    }
  },

  async submitRecordPayment() {
    try {
      const project_id = document.getElementById('pmt-project-id')?.value;
      const type = document.getElementById('pmt-type')?.value;
      const amount = parseFloat(document.getElementById('pmt-amount')?.value || 0);
      const currency = document.getElementById('pmt-currency')?.value;
      const payment_method = document.getElementById('pmt-method')?.value;
      const reference_id = document.getElementById('pmt-ref')?.value;
      const payment_date = document.getElementById('pmt-date')?.value;
      const notes = document.getElementById('pmt-notes')?.value;

      if (!project_id || !type || amount <= 0 || !payment_method) {
        Toast.error('Please complete all required payment fields.');
        return;
      }

      await API.post('/finance/record-payment', {
        project_id,
        type,
        amount,
        currency,
        payment_method,
        reference_id,
        payment_date,
        notes
      });

      Toast.success('Transaction recorded in agency ledger successfully!');
      Modal.close();
      this.loadOverviewData();
      this.loadLedgerData();
    } catch (err) {
      console.error(err);
    }
  },

  // ==========================================
  // 6. AUDIT LOGS
  // ==========================================
  async renderAuditLogs(container) {
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div>
          <h1 class="page-title">Agency Security & Audit Trail</h1>
          <p class="card-subtitle">Chronological ledger of sensitive administrative operations, quotes, assignments, and payments.</p>
        </div>
      </div>

      <div class="card">
        <div id="admin-audit-table-wrap">Loading audit events...</div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    try {
      const res = await API.get('/audit');
      const logs = res.logs || [];

      const wrap = document.getElementById('admin-audit-table-wrap');
      if (!wrap) return;

      if (logs.length === 0) {
        wrap.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">No audit logs recorded yet.</div>`;
        return;
      }

      wrap.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Details</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(l => `
                <tr>
                  <td style="font-size:0.8rem;white-space:nowrap">${State.formatDateTime(l.created_at)}</td>
                  <td>
                    <strong>${l.user_name || 'System'}</strong>
                    <div style="font-size:0.75rem;color:var(--text-muted)">${l.user_role || ''}</div>
                  </td>
                  <td><span class="badge badge-progress">${l.action}</span></td>
                  <td>${l.resource_type} (${l.resource_id || '—'})</td>
                  <td style="font-size:0.85rem">${l.details || '—'}</td>
                  <td style="font-size:0.75rem;color:var(--text-muted)">${l.ip_address || '127.0.0.1'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error(err);
    }
  }
};

window.AdminPortal = AdminPortal;

