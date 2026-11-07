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

      const isProjectCompleted = p => p.status === 'Completed' || p.status === 'Approved' || !!p.client_approved_at;
      const active = projects.filter(p => !isProjectCompleted(p) && !['Cancelled', 'Pending Approval'].includes(p.status)).length;
      const pendingQuotes = projects.filter(p => p.status === 'Pending Approval').length;
      const completed = projects.filter(isProjectCompleted).length;

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

              <!-- Status Notices & Stage Indicators (Requirements 2, 3, 4) -->
              ${p.status === 'Waiting for Editor' ? `
                <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:var(--radius-md);padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
                  <i data-lucide="clock" style="color:var(--accent-info);width:18px;height:18px;flex-shrink:0"></i>
                  <div style="font-size:0.88rem;color:var(--text-primary)">
                    <strong>Quote Approved by Admin!</strong> Waiting for assigned editor to accept & start production.
                  </div>
                </div>
              ` : ''}

              ${p.status === 'Revision Required' ? `
                <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:var(--radius-md);padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
                  <i data-lucide="rotate-ccw" style="color:var(--accent-warning);width:18px;height:18px;flex-shrink:0"></i>
                  <div style="font-size:0.88rem;color:var(--text-primary)">
                    <strong>Revisions in Progress:</strong> Your feedback has been forwarded to the production team.
                    ${p.client_revision_notes ? `<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px">"${p.client_revision_notes}"</div>` : ''}
                  </div>
                </div>
              ` : ''}

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

              <!-- Delivery Review & Client Approval Flow (Requirement 3) -->
              ${(p.client_approved_at || p.status === 'Completed' || p.status === 'Approved') ? `
                <div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);border-radius:var(--radius-lg);padding:18px 22px;margin-bottom:16px">
                  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px">
                    <div style="display:flex;align-items:center;gap:12px">
                      <div style="background:#10b981;color:#fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                        <i data-lucide="check-circle" style="width:20px;height:20px"></i>
                      </div>
                      <div>
                        <div style="display:flex;align-items:center;gap:8px">
                          <strong style="color:var(--accent-success);font-size:1.1rem">Completed Master Video Delivery</strong>
                          <span class="badge badge-success" style="font-size:0.75rem">Ready for Broadcast</span>
                        </div>
                        <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:2px">
                          Approved by you on ${State.formatDate(p.client_approved_at || p.updated_at)}. Your video production has been finalized.
                        </div>
                      </div>
                    </div>
                    ${p.final_delivery_link ? `
                      <a href="${p.final_delivery_link}" target="_blank" class="btn btn-success" style="font-weight:700;padding:9px 20px;display:inline-flex;align-items:center;gap:8px">
                        <i data-lucide="download" style="width:16px;height:16px"></i> Download Final Master
                      </a>
                    ` : '<span style="font-size:0.85rem;color:var(--text-muted)">Master link finalizing...</span>'}
                  </div>
                </div>
              ` : (p.final_delivery_link) ? `
                <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:var(--radius-lg);padding:16px 20px;margin-bottom:16px">
                  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:10px">
                    <div>
                      <div style="display:flex;align-items:center;gap:8px">
                        <i data-lucide="film" style="color:var(--accent-success);width:20px;height:20px"></i>
                        <strong style="color:var(--accent-success);font-size:1.05rem">Video Cut / Deliverables Ready for Review</strong>
                      </div>
                      <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:2px">
                        Inspect the delivered cut and approve the assets or request specific revision adjustments.
                      </div>
                    </div>
                    ${p.final_delivery_link ? `
                      <a href="${p.final_delivery_link}" target="_blank" class="btn btn-sm btn-success">
                        <i data-lucide="download" style="width:14px;height:14px"></i> Open / Download Deliverable
                      </a>
                    ` : ''}
                  </div>

                  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding-top:10px;border-top:1px solid rgba(16,185,129,0.2)">
                    <span style="font-size:0.82rem;color:var(--text-muted)">Please review before approving payment.</span>
                    <div style="display:flex;gap:8px">
                      <button class="btn btn-sm btn-outline" style="color:var(--accent-danger);border-color:rgba(239,68,68,0.3)" onclick="ClientPortal.openRevisionModal('${p.id}')">
                        <i data-lucide="rotate-ccw" style="width:14px;height:14px"></i> Request Revision
                      </button>
                      <button class="btn btn-sm btn-success" onclick="ClientPortal.approveDelivery('${p.id}')">
                        <i data-lucide="check" style="width:14px;height:14px"></i> Approve Delivery
                      </button>
                    </div>
                  </div>
                </div>
              ` : ''}

              <!-- Payment Status & Action Flow (Requirement 3 & 4) -->
              ${p.client_payment_status === 'PAID' ? `
                <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:var(--radius-md);padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
                  <i data-lucide="check-circle" style="color:var(--accent-success);width:18px;height:18px"></i>
                  <span style="font-size:0.88rem;color:var(--accent-success);font-weight:700">Payment Approved & Cleared in Full</span>
                </div>
              ` : p.client_payment_status === 'PENDING_VERIFICATION' ? `
                <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:var(--radius-md);padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
                  <i data-lucide="clock" style="color:var(--accent-warning);width:18px;height:18px"></i>
                  <span style="font-size:0.88rem;color:var(--text-primary)">
                    <strong>Payment Submitted (Verification Pending):</strong> Your UTR payment details have been submitted. Agency admin will confirm shortly.
                  </span>
                </div>
              ` : (p.status !== 'Pending Approval' && p.status !== 'Cancelled') ? `
                <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.25);border-radius:var(--radius-md);padding:12px 16px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
                  <div>
                    <strong style="color:var(--accent-danger);font-size:0.9rem">Payment Not Done Yet</strong>
                    <div style="font-size:0.8rem;color:var(--text-secondary)">
                      Remaining Balance: <strong>${State.formatCurrency(p.client_remaining_balance || p.client_price, p.currency)}</strong>. Submit your UTR reference to complete payment.
                    </div>
                  </div>
                  <button class="btn btn-sm btn-primary" onclick="ClientPortal.openSubmitPaymentModal('${p.id}', '${p.currency}', ${p.client_remaining_balance || p.client_price})">
                    <i data-lucide="credit-card" style="width:14px;height:14px"></i> Submit Payment (Enter UTR)
                  </button>
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
                  ${p.status === 'Pending Approval' ? `
                    <button type="button" class="btn btn-sm btn-outline" onclick="ClientPortal.openEditRequestModal('${p.id}')">
                      <i data-lucide="edit-3" style="width:14px;height:14px"></i> Edit Request
                    </button>
                  ` : ''}
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

          <!-- Advance Payment Option (Requirement 4) -->
          <div style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:14px;margin-bottom:14px">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:600;font-size:0.9rem">
              <input type="checkbox" id="req-advance-toggle" onchange="ClientPortal.toggleAdvanceFields(this.checked)">
              <span>Submit Advance Payment / Deposit (Optional)</span>
            </label>
            <div id="req-advance-fields" style="display:none;margin-top:12px">
              <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">
                Transferred funds will be shown to Agency Admin for verification & approval.
              </div>
              <div class="form-row">
                <div class="form-group" style="margin-bottom:8px">
                  <label class="form-label">Advance Amount (<span id="req-adv-curr-symbol">$</span>) *</label>
                  <input type="number" step="0.01" id="req-adv-amount" class="form-control" placeholder="0.00">
                </div>
                <div class="form-group" style="margin-bottom:8px">
                  <label class="form-label">Payment Method *</label>
                  <select id="req-adv-method" class="form-control">
                    <option value="UPI / GPay / IMPS">UPI / GPay / IMPS (Instant INR)</option>
                    <option value="Bank Wire / Transfer">Bank Wire / Transfer</option>
                    <option value="PayPal">PayPal</option>
                    <option value="Credit / Debit Card">Credit / Debit Card</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label">UTR / Reference Number *</label>
                  <input type="text" id="req-adv-utr" class="form-control" placeholder="12-digit UTR or Txn ID">
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label class="form-label">Payment Receipt / Screenshot Link</label>
                  <input type="url" id="req-adv-proof" class="form-control" placeholder="https://drive.google.com/...">
                </div>
              </div>
            </div>
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
    const advSymbol = document.getElementById('req-adv-curr-symbol');
    if (advSymbol) advSymbol.textContent = curr === 'INR' ? '₹' : '$';
    this.updateBudgetPreview();
  },

  toggleAdvanceFields(checked) {
    const el = document.getElementById('req-advance-fields');
    if (el) el.style.display = checked ? 'block' : 'none';
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

      // Check advance payment toggle
      let advance_payment = null;
      const advToggle = document.getElementById('req-advance-toggle');
      if (advToggle && advToggle.checked) {
        const advAmount = parseFloat(document.getElementById('req-adv-amount')?.value || 0);
        const advMethod = document.getElementById('req-adv-method')?.value;
        const advUtr = document.getElementById('req-adv-utr')?.value?.trim();
        const advProof = document.getElementById('req-adv-proof')?.value?.trim();

        if (advAmount <= 0 || !advUtr) {
          Toast.error('Please enter valid advance payment amount and UTR reference number.');
          return;
        }

        advance_payment = {
          amount: advAmount,
          payment_method: advMethod,
          reference_id: advUtr,
          receipt_url: advProof
        };
      }

      await API.post('/projects', {
        title,
        video_type,
        deadline,
        currency,
        client_budget,
        reference_link,
        spec_doc_url,
        editing_requirements,
        advance_payment
      });

      Toast.success('Project request submitted! Admin has been notified and will provide your confirmed quote.');
      Modal.close();
      this.loadOverviewData();
    } catch (err) {
      console.error(err);
      Toast.error(err.message || 'Failed to submit project request.');
    }
  },

  // ==========================================
  // EDIT REQUEST (BEFORE ADMIN APPROVAL ONLY)
  // ==========================================
  async openEditRequestModal(projectId) {
    try {
      const res = await API.get(`/projects/${projectId}`);
      const p = res.project;

      if (p.status !== 'Pending Approval' && p.status !== 'Requested') {
        Toast.error('This project has already been approved by Admin and cannot be edited.');
        return;
      }

      Modal.open({
        title: `Edit Request: ${p.title}`,
        size: 'lg',
        bodyHtml: `
          <form id="client-edit-request-form">
            <div class="form-group">
              <label class="form-label">Project Title *</label>
              <input type="text" id="edit-client-title" class="form-control" value="${p.title || ''}" required>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Video Type / Category *</label>
                <select id="edit-client-type" class="form-control" required>
                  <option value="YouTube Explainer" ${p.video_type === 'YouTube Explainer' ? 'selected' : ''}>YouTube Explainer / Deep-Dive</option>
                  <option value="Reels / TikTok" ${p.video_type === 'Reels / TikTok' ? 'selected' : ''}>Reels / TikTok / Shorts (9:16 Vertical)</option>
                  <option value="SaaS Showcase" ${p.video_type === 'SaaS Showcase' ? 'selected' : ''}>SaaS Product Showcase / Walkthrough</option>
                  <option value="Commercial" ${p.video_type === 'Commercial' ? 'selected' : ''}>Commercial / Brand Advertisement</option>
                  <option value="Documentary" ${p.video_type === 'Documentary' ? 'selected' : ''}>Documentary / Cinematic Film</option>
                  <option value="Podcast" ${p.video_type === 'Podcast' ? 'selected' : ''}>Podcast Video Multi-Cam Edit</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Target Completion Deadline</label>
                <input type="date" id="edit-client-deadline" class="form-control" value="${p.deadline ? p.deadline.slice(0, 10) : ''}">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Proposed Budget (${p.currency === 'INR' ? '₹' : '$'}) *</label>
              <input type="number" step="0.01" id="edit-client-budget" class="form-control" value="${p.client_budget || 0}" required>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Raw Footage Google Drive / Dropbox Link *</label>
                <input type="url" id="edit-client-footage" class="form-control" value="${p.reference_link || ''}" required>
              </div>

              <div class="form-group">
                <label class="form-label">Spec Doc / Script Link (Optional)</label>
                <input type="url" id="edit-client-spec" class="form-control" value="${p.spec_doc_url || ''}">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Editing Instructions & Notes</label>
              <textarea id="edit-client-instructions" class="form-control" rows="3">${p.editing_requirements || p.description || ''}</textarea>
            </div>
          </form>
        `,
        footerHtml: `
          <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary" onclick="ClientPortal.saveEditRequest('${projectId}')">
            Save Changes
          </button>
        `
      });
    } catch (err) {
      console.error(err);
      Toast.error('Failed to open edit modal.');
    }
  },

  async saveEditRequest(projectId) {
    const title = document.getElementById('edit-client-title')?.value?.trim();
    const video_type = document.getElementById('edit-client-type')?.value;
    const deadline = document.getElementById('edit-client-deadline')?.value || null;
    const client_budget = parseFloat(document.getElementById('edit-client-budget')?.value || 0);
    const reference_link = document.getElementById('edit-client-footage')?.value?.trim();
    const spec_doc_url = document.getElementById('edit-client-spec')?.value?.trim() || null;
    const editing_requirements = document.getElementById('edit-client-instructions')?.value?.trim() || null;

    if (!title || !video_type || !reference_link || client_budget <= 0) {
      Toast.error('Please complete title, video type, footage link, and budget.');
      return;
    }

    try {
      const res = await API.put(`/projects/${projectId}`, {
        title,
        video_type,
        deadline,
        client_budget,
        reference_link,
        spec_doc_url,
        editing_requirements
      });

      Modal.close();
      Toast.success(res.message || 'Project request updated!');
      this.loadOverviewData();
    } catch (err) {
      console.error(err);
      Toast.error(err.message || 'Failed to update request.');
    }
  },

  // ==========================================
  // APPROVE DELIVERY (REQUIREMENT 3)
  // ==========================================
  async approveDelivery(projectId) {
    if (!confirm('Are you satisfied with the delivered video cut and ready to approve it?')) return;
    try {
      const res = await API.post(`/projects/${projectId}/client-approve`, {});
      Toast.success(res.message || 'Video delivery approved! Please complete payment below.');
      this.loadOverviewData();
    } catch (err) {
      console.error(err);
      Toast.error(err.message || 'Failed to approve delivery.');
    }
  },

  // ==========================================
  // REQUEST REVISION (REQUIREMENT 3)
  // ==========================================
  openRevisionModal(projectId) {
    Modal.open({
      title: 'Request Video Revisions',
      size: 'md',
      bodyHtml: `
        <div style="margin-bottom:12px;font-size:0.88rem;color:var(--text-secondary)">
          Describe what you would like adjusted, changed, or improved in this video cut. Your instructions will be sent directly to the Agency Admin and assigned editor.
        </div>
        <div class="form-group">
          <label class="form-label">Revision Instructions & Feedback *</label>
          <textarea id="client-revision-notes" class="form-control" rows="5" placeholder="e.g. Please trim intro at 00:15, swap background music track, and make title font bolder..."></textarea>
        </div>
      `,
      footerHtml: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="ClientPortal.submitRevisionRequest('${projectId}')">
          Submit Revision Request
        </button>
      `
    });
  },

  async submitRevisionRequest(projectId) {
    const revision_notes = document.getElementById('client-revision-notes')?.value?.trim();
    if (!revision_notes) {
      Toast.error('Please enter your revision feedback.');
      return;
    }

    try {
      const res = await API.post(`/projects/${projectId}/client-revision`, { revision_notes });
      Modal.close();
      Toast.success(res.message || 'Revision request submitted!');
      this.loadOverviewData();
    } catch (err) {
      console.error(err);
      Toast.error(err.message || 'Failed to submit revision request.');
    }
  },

  // ==========================================
  // COMPLETE PAYMENT / UTR SUBMISSION (REQUIREMENT 3)
  // ==========================================
  openSubmitPaymentModal(projectId, currency = 'USD', balance = 0) {
    const currSymbol = currency === 'INR' ? '₹' : '$';
    Modal.open({
      title: 'Complete Project Payment',
      size: 'md',
      bodyHtml: `
        <div style="background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:14px;margin-bottom:16px">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Agency Official Accounts</div>
          <div style="font-size:0.85rem;line-height:1.6">
            ${currency === 'INR' ? `
              <div>• <strong>UPI ID:</strong> <span style="font-family:monospace;font-weight:700;color:var(--accent-primary)">cineflow@okaxis</span> (GPay / PhonePe / Paytm)</div>
              <div>• <strong>Bank:</strong> HDFC Bank Ltd | <strong>A/C:</strong> 502000889211 | <strong>IFSC:</strong> HDFC0001234</div>
            ` : `
              <div>• <strong>PayPal / Wire:</strong> <span style="font-family:monospace;font-weight:700;color:var(--accent-primary)">billing@cineflowstudio.com</span></div>
              <div>• <strong>International Wire / ACH:</strong> Available upon invoice request</div>
            `}
          </div>
        </div>

        <form id="client-submit-payment-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Payment Amount (${currSymbol}) *</label>
              <input type="number" step="0.01" id="client-pmt-amount" class="form-control" value="${balance > 0 ? balance : ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Payment Method *</label>
              <select id="client-pmt-method" class="form-control" required>
                <option value="UPI / GPay / IMPS">UPI / GPay / IMPS (Instant INR)</option>
                <option value="Bank Wire / Transfer">Bank Wire / Transfer</option>
                <option value="PayPal">PayPal</option>
                <option value="Credit / Debit Card">Credit / Debit Card</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">UTR / Transaction Reference Number *</label>
            <input type="text" id="client-pmt-utr" class="form-control" placeholder="e.g. 12-digit UTR, IMPS Ref, or PayPal TXID" required>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">Admin will match this UTR with bank records to mark your order approved.</div>
          </div>

          <div class="form-group">
            <label class="form-label">Payment Receipt / Screenshot Link (Optional)</label>
            <input type="url" id="client-pmt-proof" class="form-control" placeholder="https://drive.google.com/...">
          </div>

          <div class="form-group">
            <label class="form-label">Notes (Optional)</label>
            <input type="text" id="client-pmt-notes" class="form-control" placeholder="e.g. Paid via GPay from Sarah Jenkins">
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="ClientPortal.submitClientPayment('${projectId}')">
          Submit Payment Details
        </button>
      `
    });
  },

  async submitClientPayment(projectId) {
    const amount = parseFloat(document.getElementById('client-pmt-amount')?.value || 0);
    const payment_method = document.getElementById('client-pmt-method')?.value;
    const reference_id = document.getElementById('client-pmt-utr')?.value?.trim();
    const receipt_url = document.getElementById('client-pmt-proof')?.value?.trim() || null;
    const notes = document.getElementById('client-pmt-notes')?.value?.trim() || null;

    if (amount <= 0 || !payment_method || !reference_id) {
      Toast.error('Please enter payment amount, payment method, and UTR reference ID.');
      return;
    }

    try {
      const res = await API.post(`/projects/${projectId}/submit-payment`, {
        amount,
        payment_method,
        reference_id,
        receipt_url,
        notes
      });

      Modal.close();
      Toast.success(res.message || 'Payment details submitted! Admin will verify.');
      this.loadOverviewData();
    } catch (err) {
      console.error(err);
      Toast.error(err.message || 'Failed to submit payment.');
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

