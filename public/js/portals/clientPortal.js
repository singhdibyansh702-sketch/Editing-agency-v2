/**
 * Client Portal View Controllers
 * Self-service video ordering, dual-currency budgeting, quote reviews, and master deliveries.
 * Editor identity and payout rates are strictly isolated.
 */

const ClientPortal = {
  selectedCurrency: 'USD',

  async renderOverview(container) {
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
        <div>
          <h1 class="page-title">Creator Dashboard</h1>
          <p class="card-subtitle">Manage video production requests, quotes, active projects, and final 4K master downloads.</p>
        </div>
        <button class="btn btn-primary" onclick="ClientPortal.openNewRequestModal()">
          <i data-lucide="video" style="width:16px;height:16px"></i> Submit New Video Request
        </button>
      </div>

      <!-- Quick Metrics -->
      <div id="client-stats-grid" class="stats-grid"></div>

      <!-- Projects Section -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">My Video Productions</h2>
            <p class="card-subtitle">Real-time status updates, approved quotes, and final delivery links.</p>
          </div>
        </div>
        <div id="client-projects-list">Loading productions...</div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    await this.loadOverviewData();
  },

  async loadOverviewData() {
    try {
      const res = await API.get('/projects');
      const projects = res.projects || [];

      const active = projects.filter(p => !['Completed', 'Cancelled', 'Pending Approval'].includes(p.status)).length;
      const pendingQuotes = projects.filter(p => p.status === 'Pending Approval').length;
      const completed = projects.filter(p => p.status === 'Completed').length;

      const statsGrid = document.getElementById('client-stats-grid');
      if (statsGrid) {
        statsGrid.innerHTML = `
          <div class="stat-card">
            <div>
              <div class="stat-title">Active In Production</div>
              <div class="stat-value">${active}</div>
              <div class="stat-meta">Under professional edit</div>
            </div>
            <div class="stat-icon icon-blue"><i data-lucide="play-circle"></i></div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Pending Quotes</div>
              <div class="stat-value">${pendingQuotes}</div>
              <div class="stat-meta">Awaiting Admin proposal</div>
            </div>
            <div class="stat-icon icon-amber"><i data-lucide="file-clock"></i></div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Completed Masters</div>
              <div class="stat-value">${completed}</div>
              <div class="stat-meta">Ready for broadcast</div>
            </div>
            <div class="stat-icon icon-green"><i data-lucide="check-circle-2"></i></div>
          </div>
        `;
      }

      const listWrap = document.getElementById('client-projects-list');
      if (!listWrap) return;

      if (projects.length === 0) {
        listWrap.innerHTML = `
          <div style="text-align:center;padding:48px;color:var(--text-muted)">
            <i data-lucide="video" style="width:40px;height:40px;margin-bottom:12px"></i>
            <p style="font-size:1.05rem;font-weight:600">No video editing requests yet.</p>
            <p style="font-size:0.85rem;margin-top:4px">Click below to submit your raw footage and editing requirements.</p>
            <button class="btn btn-primary" style="margin-top:16px" onclick="ClientPortal.openNewRequestModal()">
              Submit Your First Project
            </button>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      listWrap.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:18px">
          ${projects.map(p => `
            <div style="border:1px solid var(--border-color);border-radius:var(--radius-xl);padding:22px;background:var(--bg-card);transition:all var(--transition-fast)">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:14px">
                <div>
                  <div style="display:flex;align-items:center;gap:10px">
                    <h3 style="font-size:1.15rem;font-weight:700">${p.title}</h3>
                    <span style="font-size:0.8rem;font-weight:700;color:var(--text-muted);background:var(--bg-tertiary);padding:2px 8px;border-radius:var(--radius-sm)">
                      ${p.project_code}
                    </span>
                  </div>
                  <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px">
                    Video Type: <strong>${p.video_type}</strong> | Submitted: <strong>${State.formatDate(p.created_at)}</strong> | Target Deadline: <strong>${State.formatDate(p.deadline)}</strong>
                  </div>
                </div>

                <div style="display:flex;align-items:center;gap:14px">
                  <div style="text-align:right">
                    ${p.status === 'Pending Approval' ? `
                      <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;font-weight:700">Proposed Budget</div>
                      <div style="font-size:1.25rem;font-weight:800;color:var(--accent-primary)">
                        ${State.formatCurrency(p.client_budget, p.currency)}
                      </div>
                    ` : `
                      <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;font-weight:700">Agreed Project Price</div>
                      <div style="font-size:1.25rem;font-weight:800;color:var(--accent-primary)">
                        ${State.formatCurrency(p.client_price, p.currency)}
                      </div>
                    `}
                  </div>
                  <div>${State.getStatusBadge(p.status)}</div>
                </div>
              </div>

              <!-- Admin Quote Note / Negotiation Box -->
              ${p.admin_quote_note ? `
                <div style="background:rgba(37,99,235,0.06);border:1px solid rgba(37,99,235,0.2);border-radius:var(--radius-md);padding:12px 16px;margin-bottom:14px">
                  <div style="font-size:0.75rem;font-weight:700;color:var(--accent-primary);text-transform:uppercase;margin-bottom:4px">
                    Admin Quote & Agreement Note
                  </div>
                  <div style="font-size:0.88rem;color:var(--text-primary)">
                    ${p.admin_quote_note}
                  </div>
                </div>
              ` : ''}

              <!-- Master Delivery Download (If Completed) -->
              ${p.status === 'Completed' && p.final_delivery_link ? `
                <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:var(--radius-lg);padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
                  <div>
                    <div style="display:flex;align-items:center;gap:8px">
                      <i data-lucide="check-circle" style="color:var(--accent-success);width:20px;height:20px"></i>
                      <strong style="color:var(--accent-success);font-size:1rem">Final 4K Master Deliverable Ready!</strong>
                    </div>
                    <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:2px">
                      Your high-res renders, master exports, and social vertical cuts are packaged.
                    </div>
                  </div>
                  <a href="${p.final_delivery_link}" target="_blank" class="btn btn-success">
                    <i data-lucide="download" style="width:16px;height:16px"></i> Download Final Assets
                  </a>
                </div>
              ` : ''}

              <!-- Footer Details -->
              <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid var(--border-subtle);font-size:0.85rem">
                <div>
                  ${p.reference_link ? `
                    <span style="color:var(--text-muted)">Raw Footage:</span> 
                    <a href="${p.reference_link}" target="_blank" style="color:var(--accent-primary);text-decoration:underline">Google Drive Folder</a>
                  ` : ''}
                </div>

                <div style="display:flex;gap:10px">
                  <a href="#chat" class="btn btn-sm btn-outline">
                    <i data-lucide="message-square" style="width:14px;height:14px"></i> Chat with Agency Admin
                  </a>
                  <button type="button" class="btn btn-sm btn-outline" style="color:var(--accent-danger);border-color:rgba(239,68,68,0.3)" onclick="ClientPortal.confirmDeleteProject('${p.id}', '${(p.title || '').replace(/'/g, "\\'")}')">
                    <i data-lucide="trash-2" style="width:14px;height:14px"></i> Delete
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error(err);
    }
  },

  // ==========================================
  // SUBMIT NEW EDITING REQUEST (DUAL CURRENCY)
  // ==========================================
  openNewRequestModal() {
    this.selectedCurrency = 'USD';

    Modal.open({
      title: 'Submit New Video Editing Request',
      size: 'lg',
      bodyHtml: `
        <form id="client-new-request-form">
          <div class="form-group">
            <label class="form-label">Project Title *</label>
            <input type="text" id="req-title" class="form-control" placeholder="e.g. YouTube Product Launch Explainer (Episode 4)" required>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Video Type / Category *</label>
              <select id="req-type" class="form-control" required>
                <option value="YouTube Explainer">YouTube Explainer / Deep-Dive</option>
                <option value="Reels / TikTok">Reels / TikTok / Shorts (9:16 Vertical)</option>
                <option value="SaaS Showcase">SaaS Product Showcase / Walkthrough</option>
                <option value="Commercial">Commercial / Brand Advertisement</option>
                <option value="Documentary">Documentary / Cinematic Film</option>
                <option value="Podcast">Podcast Video Multi-Cam Edit</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Target Delivery Deadline</label>
              <input type="date" id="req-deadline" class="form-control">
            </div>
          </div>

          <!-- Currency & Budget Negotiation -->
          <div style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:16px;margin-bottom:18px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px">
              <div>
                <label class="form-label" style="margin-bottom:0">Billing Currency *</label>
                <div style="font-size:0.75rem;color:var(--text-muted)">Select preferred billing denomination</div>
              </div>
              <div class="currency-toggle-group">
                <button type="button" class="currency-toggle-btn active" id="btn-curr-usd" onclick="ClientPortal.setCurrency('USD')">
                  $ USD (US Dollars)
                </button>
                <button type="button" class="currency-toggle-btn" id="btn-curr-inr" onclick="ClientPortal.setCurrency('INR')">
                  ₹ INR (Indian Rupees)
                </button>
              </div>
            </div>

            <div class="form-group" style="margin-bottom:0">
              <label class="form-label">Proposed Budget (<span id="req-curr-symbol">$</span>) *</label>
              <div style="position:relative">
                <input type="text" inputmode="decimal" id="req-budget" class="form-control" placeholder="e.g. 600 or 25000" autocomplete="off" spellcheck="false" required oninput="ClientPortal.onBudgetInput(this)" onkeydown="ClientPortal.onBudgetKeyDown(event)">
              </div>
              <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:6px;display:flex;justify-content:space-between">
                <span>Formatted Preview: <strong id="req-budget-preview">$0.00</strong></span>
                <span style="color:var(--text-muted)">Admin will review and counter-quote if needed.</span>
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Raw Footage Google Drive / Dropbox Link *</label>
              <input type="url" id="req-footage" class="form-control" placeholder="https://drive.google.com/drive/folders/..." required>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">Ensure folder permissions are set to "Anyone with link can view".</div>
            </div>

            <div class="form-group">
              <label class="form-label">Spec Doc / Script Link (Optional)</label>
              <input type="url" id="req-spec" class="form-control" placeholder="https://docs.google.com/document/d/...">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Detailed Editing Instructions & Style Notes</label>
            <textarea id="req-instructions" class="form-control" placeholder="Provide pacing preferences, reference video URLs, required sound effects, branding hex colors, lower-thirds text..."></textarea>
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="ClientPortal.submitRequest()">
          Submit Project Request
        </button>
      `
    });
  },

  setCurrency(curr) {
    this.selectedCurrency = curr;
    document.getElementById('btn-curr-usd')?.classList.toggle('active', curr === 'USD');
    document.getElementById('btn-curr-inr')?.classList.toggle('active', curr === 'INR');
    const symbolEl = document.getElementById('req-curr-symbol');
    if (symbolEl) symbolEl.textContent = curr === 'INR' ? '₹' : '$';
    this.updateBudgetPreview();
  },

  onBudgetInput(input) {
    if (!input) return;
    // Strip everything except numbers and decimal point
    let val = input.value.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }
    input.value = val;
    this.updateBudgetPreview();
  },

  onBudgetKeyDown(e) {
    const numpadMap = {
      Numpad0: '0', Numpad1: '1', Numpad2: '2', Numpad3: '3', Numpad4: '4',
      Numpad5: '5', Numpad6: '6', Numpad7: '7', Numpad8: '8', Numpad9: '9',
      NumpadDecimal: '.'
    };
    if (numpadMap[e.code] !== undefined && e.key !== numpadMap[e.code]) {
      e.preventDefault();
      const input = e.target;
      const char = numpadMap[e.code];
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      input.value = input.value.substring(0, start) + char + input.value.substring(end);
      if (typeof input.setSelectionRange === 'function') {
        input.setSelectionRange(start + 1, start + 1);
      }
      this.onBudgetInput(input);
      return;
    }
    // Prevent ArrowUp / ArrowDown / PageUp / PageDown from scrolling or altering values like a spinner
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) {
      e.preventDefault();
    }
  },

  updateBudgetPreview() {
    const raw = document.getElementById('req-budget')?.value || '0';
    const clean = String(raw).replace(/[^0-9.]/g, '');
    const val = parseFloat(clean) || 0;
    const previewEl = document.getElementById('req-budget-preview');
    if (previewEl) {
      previewEl.textContent = State.formatCurrency(val, this.selectedCurrency);
    }
  },

  async submitRequest() {
    try {
      const title = document.getElementById('req-title')?.value;
      const video_type = document.getElementById('req-type')?.value;
      const deadline = document.getElementById('req-deadline')?.value;
      const currency = this.selectedCurrency;
      const rawBudget = document.getElementById('req-budget')?.value || '0';
      const client_budget = parseFloat(String(rawBudget).replace(/[^0-9.]/g, '')) || 0;
      const reference_link = document.getElementById('req-footage')?.value;
      const spec_doc_url = document.getElementById('req-spec')?.value;
      const editing_requirements = document.getElementById('req-instructions')?.value;

      if (!title || !video_type || !reference_link || client_budget <= 0) {
        Toast.error('Please complete title, video type, raw footage link, and proposed budget.');
        return;
      }

      await API.post('/projects', {
        title,
        video_type,
        deadline,
        currency,
        client_budget,
        reference_link,
        spec_doc_url,
        editing_requirements
      });

      Toast.success('Project request submitted! Admin has been notified and will provide your confirmed quote.');
      Modal.close();
      this.loadOverviewData();
    } catch (err) {
      console.error(err);
    }
  },

  confirmDeleteProject(projectId, projectTitle) {
    Modal.open({
      title: 'Delete Project Request',
      bodyHtml: `
        <div style="padding:10px 0">
          <p style="font-size:0.95rem;margin-bottom:12px;color:var(--text-primary)">
            Are you sure you want to delete <strong>${projectTitle}</strong>?
          </p>
          <p style="font-size:0.85rem;color:var(--text-muted);line-height:1.5">
            If this project was submitted by mistake or is no longer required, it will be permanently removed from your dashboard and from agency production.
          </p>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-danger" onclick="ClientPortal.deleteProject('${projectId}')">
          <i data-lucide="trash-2" style="width:14px;height:14px"></i> Yes, Delete Project
        </button>
      `
    });
    if (window.lucide) window.lucide.createIcons();
  },

  async deleteProject(projectId) {
    try {
      await API.delete(`/projects/${projectId}`);
      Toast.success('Project has been deleted.');
      Modal.close();
      await this.loadOverviewData();
    } catch (err) {
      console.error(err);
      Toast.error(err.message || 'Failed to delete project.');
    }
  }
};

window.ClientPortal = ClientPortal;

