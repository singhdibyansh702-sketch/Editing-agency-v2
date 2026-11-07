/**
 * Editor Portal View Controllers
 * Strictly segregated assigned workspace. Client identity and pricing are completely isolated.
 */

const EditorPortal = {
  async renderOverview(container) {
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <div>
          <h1 class="page-title">Editor Production Hub</h1>
          <p class="card-subtitle">Active video assignments, footage access, delivery deadlines, and payouts.</p>
        </div>
      </div>

      <!-- Metrics Grid -->
      <div id="editor-stats-grid" class="stats-grid"></div>

      <!-- Active Assigned Projects -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">My Assigned Video Projects</h2>
            <p class="card-subtitle">Footage assets, editing briefs, specs, and cut submission portals.</p>
          </div>
        </div>
        <div id="editor-projects-list">Loading assignments...</div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    await this.loadOverviewData();
  },

  async loadOverviewData() {
    try {
      const res = await API.get('/projects');
      const projects = res.projects || [];

      // Stats
      const assigned = projects.filter(p => p.status === 'Assigned').length;
      const inProgress = projects.filter(p => p.status === 'In Progress').length;
      const submitted = projects.filter(p => p.status === 'Submitted for Review').length;
      const revisions = projects.filter(p => p.status === 'Revision Required').length;
      const completed = projects.filter(p => p.status === 'Completed').length;

      // Payout totals for this editor
      let totalAgreedUSD = 0;
      let totalAgreedINR = 0;
      projects.forEach(p => {
        if (p.currency === 'INR') totalAgreedINR += parseFloat(p.editor_payment || 0);
        else totalAgreedUSD += parseFloat(p.editor_payment || 0);
      });

      const statsGrid = document.getElementById('editor-stats-grid');
      if (statsGrid) {
        statsGrid.innerHTML = `
          <div class="stat-card">
            <div>
              <div class="stat-title">Active Edits</div>
              <div class="stat-value">${inProgress + assigned}</div>
              <div class="stat-meta">Under production</div>
            </div>
            <div class="stat-icon icon-blue"><i data-lucide="scissors"></i></div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Revisions Required</div>
              <div class="stat-value" style="color:${revisions > 0 ? 'var(--accent-danger)' : 'inherit'}">${revisions}</div>
              <div class="stat-meta">Pending client/admin feedback</div>
            </div>
            <div class="stat-icon icon-amber"><i data-lucide="alert-circle"></i></div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Awaiting Approval</div>
              <div class="stat-value">${submitted}</div>
              <div class="stat-meta">Cut submitted to Admin</div>
            </div>
            <div class="stat-icon icon-purple"><i data-lucide="clock"></i></div>
          </div>

          <div class="stat-card">
            <div>
              <div class="stat-title">Total Agreed Payout</div>
              <div class="stat-value" style="font-size:1.35rem;color:var(--accent-success)">
                $${totalAgreedUSD.toLocaleString()} / ₹${totalAgreedINR.toLocaleString()}
              </div>
              <div class="stat-meta">Assigned contract total</div>
            </div>
            <div class="stat-icon icon-green"><i data-lucide="dollar-sign"></i></div>
          </div>
        `;
      }

      // Projects List
      const listWrap = document.getElementById('editor-projects-list');
      if (!listWrap) return;

      if (projects.length === 0) {
        listWrap.innerHTML = `
          <div style="text-align:center;padding:48px;color:var(--text-muted)">
            <i data-lucide="film" style="width:40px;height:40px;margin-bottom:12px"></i>
            <p>You have no assigned projects currently. New assignments will appear here automatically.</p>
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
                    Video Type: <strong>${p.video_type}</strong> | Confirmed Deadline: <strong>${State.formatDate(p.deadline)}</strong>
                  </div>
                </div>

                <div style="display:flex;align-items:center;gap:14px">
                  <div style="text-align:right">
                    <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;font-weight:700">Agreed Payout</div>
                    <div style="font-size:1.25rem;font-weight:800;color:var(--accent-success)">
                      ${State.formatCurrency(p.editor_payment, p.currency)}
                    </div>
                    ${p.editor_deduction_amount > 0 ? `
                      <div style="font-size:0.75rem;color:var(--accent-danger);font-weight:600;margin-top:2px">
                        Deduction: -${State.formatCurrency(p.editor_deduction_amount, p.currency)}
                      </div>
                      <div style="font-size:0.72rem;color:var(--text-muted)">
                        Reason: ${p.deduction_reason || 'Penalty/Late delivery'}
                      </div>
                      <div style="font-size:0.8rem;font-weight:700;color:#10b981;margin-top:2px">
                        Net Paid: ${State.formatCurrency(p.editor_paid_amount, p.currency)} (${p.editor_payment_status || 'PAID'})
                      </div>
                    ` : `
                      <div style="font-size:0.78rem;font-weight:700;color:${p.editor_payment_status === 'PAID' ? 'var(--accent-success)' : 'var(--text-muted)'};margin-top:2px">
                        Payout Status: ${p.editor_payment_status || 'UNPAID'}
                      </div>
                    `}
                  </div>
                  <div>${State.getStatusBadge(p.status)}</div>
                </div>
              </div>

              ${p.status === 'Waiting for Editor' ? `
                <div style="background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.3);border-radius:var(--radius-lg);padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
                  <div style="display:flex;align-items:center;gap:10px">
                    <i data-lucide="bell" style="color:var(--accent-primary);width:22px;height:22px;flex-shrink:0"></i>
                    <div>
                      <div style="font-weight:700;font-size:0.95rem;color:var(--text-primary)">New Project Assignment: Review Specs Before Starting</div>
                      <div style="font-size:0.82rem;color:var(--text-secondary)">Inspect footage drive, instructions, and deadline. Click below to view full details and accept when ready to edit.</div>
                    </div>
                  </div>
                  <div style="display:flex;gap:8px">
                    <button class="btn btn-sm btn-outline" onclick="EditorPortal.openProjectDetailsModal('${p.id}')">
                      <i data-lucide="eye" style="width:14px;height:14px"></i> View Details
                    </button>
                    <button class="btn btn-sm btn-success" style="background:#10b981;color:#fff;font-weight:700;padding:8px 18px" onclick="EditorPortal.acceptProject('${p.id}')">
                      <i data-lucide="play" style="width:16px;height:16px"></i> Accept & Start Working
                    </button>
                  </div>
                </div>
              ` : ''}

              ${(p.status === 'Revision Required' || p.client_revision_notes) ? `
                <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius-lg);padding:14px 18px;margin-bottom:16px">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                    <i data-lucide="alert-triangle" style="color:var(--accent-danger);width:18px;height:18px;flex-shrink:0"></i>
                    <strong style="color:var(--accent-danger);font-size:0.95rem">Client Revision Request Message:</strong>
                  </div>
                  <div style="background:var(--bg-card);border-radius:var(--radius-md);padding:12px 16px;border-left:4px solid var(--accent-danger);font-size:0.92rem;color:var(--text-primary);line-height:1.5">
                    "${p.client_revision_notes || 'Client requested revisions on this cut. Please inspect instructions and submit a revised cut.'}"
                  </div>
                </div>
              ` : ''}

              <!-- Assets & Instructions -->
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;margin-bottom:16px;padding:14px;background:var(--bg-tertiary);border-radius:var(--radius-lg)">
                <div>
                  <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Raw Assets & Documentation</div>
                  ${p.reference_link ? `
                    <div style="margin-bottom:6px">
                      <a href="${p.reference_link}" target="_blank" class="btn btn-sm btn-outline" style="background:var(--bg-card)">
                        <i data-lucide="folder" style="width:14px;height:14px"></i> Open Raw Footage Drive
                      </a>
                    </div>
                  ` : '<div style="font-size:0.82rem;color:var(--text-muted)">Footage link not attached</div>'}

                  ${p.spec_doc_url ? `
                    <div>
                      <a href="${p.spec_doc_url}" target="_blank" class="btn btn-sm btn-outline" style="background:var(--bg-card)">
                        <i data-lucide="file-text" style="width:14px;height:14px"></i> Open Brief & Spec Doc
                      </a>
                    </div>
                  ` : ''}
                </div>

                <div>
                  <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Editing Instructions</div>
                  <p style="font-size:0.85rem;color:var(--text-secondary);max-height:80px;overflow-y:auto">
                    ${p.editing_requirements || p.description || 'Follow standard agency grading and audio loudness parameters (-14 LUFS).'}
                  </p>
                </div>
              </div>

              <!-- Actions Bar -->
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
                <div style="display:flex;gap:8px">
                  <button class="btn btn-sm btn-outline" onclick="EditorPortal.openProjectDetailsModal('${p.id}')">
                    <i data-lucide="eye" style="width:14px;height:14px"></i> View Details
                  </button>
                  <button class="btn btn-sm btn-outline" onclick="EditorPortal.inspectFootage('${p.reference_link || ''}')">
                    <i data-lucide="activity" style="width:14px;height:14px"></i> Technical Video Inspector
                  </button>
                </div>

                <div style="display:flex;gap:10px">
                  ${p.status === 'Waiting for Editor' ? `
                    <button class="btn btn-sm btn-success" style="background:#10b981;color:#fff;font-weight:700" onclick="EditorPortal.acceptProject('${p.id}')">
                      <i data-lucide="play" style="width:14px;height:14px"></i> Accept & Start Working
                    </button>
                  ` : `
                    <button class="btn btn-sm btn-primary" onclick="EditorPortal.openSubmitCutModal('${p.id}', '${p.project_code}')">
                      <i data-lucide="upload" style="width:14px;height:14px"></i> Submit Cut for Review
                    </button>
                  `}
                  <a href="#chat" class="btn btn-sm btn-secondary">
                    <i data-lucide="message-square" style="width:14px;height:14px"></i> Chat with Admin
                  </a>
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

  async openSubmitCutModal(projectId, projectCode) {
    Modal.open({
      title: `Submit Video Cut: ${projectCode}`,
      bodyHtml: `
        <form id="editor-submit-cut-form">
          <p style="font-size:0.88rem;color:var(--text-secondary);margin-bottom:16px">
            Provide the direct preview link to your exported cut (Google Drive, Dropbox, Frame.io, or Vimeo). The Admin will inspect your deliverable before approving for client presentation.
          </p>

          <div class="form-group">
            <label class="form-label">Cut Link (Google Drive / Dropbox) *</label>
            <input type="url" id="cut-submission-link" class="form-control" placeholder="https://drive.google.com/file/d/..." required>
          </div>

          <div class="form-group">
            <label class="form-label">Submission Notes & Changelog</label>
            <textarea id="cut-submission-notes" class="form-control" placeholder="Detail color grade LUT applied, audio mix changes, motion titles added, or questions for Admin..."></textarea>
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="EditorPortal.submitCut('${projectId}')">
          Submit Cut to Admin
        </button>
      `
    });
  },

  async submitCut(projectId) {
    try {
      const submission_link = document.getElementById('cut-submission-link')?.value;
      const notes = document.getElementById('cut-submission-notes')?.value;

      if (!submission_link) {
        Toast.error('Please enter the video submission link.');
        return;
      }

      await API.post(`/projects/${projectId}/submit`, { submission_link, notes });
      Toast.success('Cut submitted for review! Admin has been notified.');
      Modal.close();
      this.loadOverviewData();
    } catch (err) {
      console.error(err);
    }
  },

  async openProjectDetailsModal(projectId) {
    try {
      const res = await API.get(`/projects/${projectId}`);
      const p = res.project;
      const submissions = res.submissions || [];

      Modal.open({
        title: `${p.project_code}: ${p.title}`,
        size: 'lg',
        bodyHtml: `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
            <div>
              <span style="font-size:0.85rem;color:var(--text-muted)">Video Type:</span> <strong>${p.video_type}</strong> | 
              <span style="font-size:0.85rem;color:var(--text-muted)">Confirmed Deadline:</span> <strong>${State.formatDate(p.deadline)}</strong>
            </div>
            <div>${State.getStatusBadge(p.status)}</div>
          </div>

          ${p.status === 'Waiting for Editor' ? `
            <div style="background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.3);border-radius:var(--radius-lg);padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
              <div>
                <strong style="color:var(--accent-primary)">Project Awaiting Your Acceptance</strong>
                <div style="font-size:0.83rem;color:var(--text-secondary);margin-top:2px">
                  Review the brief, footage drive, and instructions below. When ready to begin editing, click "Accept & Start Working".
                </div>
              </div>
              <button class="btn btn-success" style="background:#10b981;color:#fff;font-weight:700" onclick="EditorPortal.acceptProject('${p.id}'); Modal.close();">
                <i data-lucide="play" style="width:14px;height:14px"></i> Accept & Start Working
              </button>
            </div>
          ` : ''}

          ${(p.status === 'Revision Required' || p.client_revision_notes) ? `
            <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius-md);padding:14px 18px;margin-bottom:16px">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <i data-lucide="alert-triangle" style="color:var(--accent-danger);width:18px;height:18px"></i>
                <strong style="color:var(--accent-danger);font-size:0.95rem">Client Revision Request Message:</strong>
              </div>
              <div style="background:var(--bg-card);border-radius:var(--radius-md);padding:12px 16px;border-left:4px solid var(--accent-danger);font-size:0.92rem;color:var(--text-primary);line-height:1.5">
                "${p.client_revision_notes || 'Client requested revisions on this cut. Please inspect instructions and submit a revised cut.'}"
              </div>
            </div>
          ` : ''}

          <!-- Payout & Contract -->
          <div style="padding:14px;background:var(--bg-tertiary);border-radius:var(--radius-lg);margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <div>
              <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;font-weight:700">Agreed Editor Payout</div>
              <div style="font-size:1.35rem;font-weight:800;color:var(--accent-success);margin-top:2px">
                ${State.formatCurrency(p.editor_payment, p.currency)}
              </div>
            </div>
            <div style="text-align:right">
              ${p.editor_deduction_amount > 0 ? `
                <div style="font-size:0.8rem;color:var(--accent-danger);font-weight:600">
                  Deduction: -${State.formatCurrency(p.editor_deduction_amount, p.currency)} (${p.deduction_reason || 'Penalty/Late'})
                </div>
                <div style="font-size:0.85rem;color:#10b981;font-weight:700;margin-top:2px">
                  Net Paid: ${State.formatCurrency(p.editor_paid_amount, p.currency)} [PAID]
                </div>
              ` : `
                <div style="font-size:0.85rem;font-weight:700;color:${p.editor_payment_status === 'PAID' ? 'var(--accent-success)' : 'var(--text-muted)'}">
                  Payout Status: ${p.editor_payment_status || 'UNPAID'}
                </div>
              `}
            </div>
          </div>

          <!-- Raw Assets & Instructions -->
          <div style="margin-bottom:16px;display:flex;flex-direction:column;gap:12px">
            <div style="padding:12px 16px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md)">
              <strong style="font-size:0.82rem;color:var(--text-muted);text-transform:uppercase">Raw Footage Assets:</strong>
              ${p.reference_link ? `
                <div style="margin-top:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                  <a href="${p.reference_link}" target="_blank" class="btn btn-sm btn-outline" style="background:var(--bg-tertiary)">
                    <i data-lucide="folder" style="width:14px;height:14px"></i> Open Raw Footage Drive
                  </a>
                  <button class="btn btn-sm btn-outline" onclick="EditorPortal.inspectFootage('${p.reference_link}'); Modal.close();">
                    <i data-lucide="activity" style="width:14px;height:14px"></i> Inspect in Technical Viewer
                  </button>
                </div>
              ` : '<div style="font-size:0.85rem;color:var(--text-muted);margin-top:4px">No footage drive attached</div>'}
            </div>

            ${p.spec_doc_url ? `
              <div style="padding:12px 16px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md)">
                <strong style="font-size:0.82rem;color:var(--text-muted);text-transform:uppercase">Brief & Spec Document:</strong>
                <div style="margin-top:6px">
                  <a href="${p.spec_doc_url}" target="_blank" style="font-size:0.85rem;color:var(--accent-primary);text-decoration:underline">
                    ${p.spec_doc_url}
                  </a>
                </div>
              </div>
            ` : ''}

            <div style="padding:14px 16px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md)">
              <strong style="font-size:0.82rem;color:var(--text-muted);text-transform:uppercase">Editing Requirements & Instructions:</strong>
              <div style="margin-top:6px;font-size:0.9rem;line-height:1.5;color:var(--text-primary)">
                ${p.editing_requirements || p.description || 'Follow standard agency grading and loudness parameters (-14 LUFS).'}
              </div>
            </div>
          </div>

          <!-- Cut Submissions -->
          <div style="margin-top:16px">
            <h4 style="font-size:0.95rem;font-weight:700;margin-bottom:8px">Your Cut Submissions (${submissions.length})</h4>
            ${submissions.length === 0 ? `<p style="font-size:0.85rem;color:var(--text-muted)">No cuts submitted yet.</p>` : `
              <div style="display:flex;flex-direction:column;gap:8px">
                ${submissions.map(s => `
                  <div style="padding:10px 14px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);display:flex;justify-content:space-between;align-items:center">
                    <div>
                      <strong>Version ${s.version}</strong> - <span style="font-size:0.8rem;color:var(--text-muted)">${State.formatDateTime(s.created_at)}</span>
                      <div style="font-size:0.82rem;color:var(--text-secondary);margin-top:2px">${s.notes || 'No submission note'}</div>
                    </div>
                    <div>
                      <a href="${s.submission_link}" target="_blank" class="btn btn-sm btn-outline">Preview Cut</a>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        `,
        footerHtml: `
          <button class="btn btn-secondary" onclick="Modal.close()">Close</button>
          ${p.status === 'Waiting for Editor' ? `
            <button class="btn btn-success" style="background:#10b981;color:#fff;font-weight:700" onclick="EditorPortal.acceptProject('${p.id}'); Modal.close();">
              <i data-lucide="play" style="width:14px;height:14px"></i> Accept & Start Working
            </button>
          ` : `
            <button class="btn btn-primary" onclick="Modal.close(); EditorPortal.openSubmitCutModal('${p.id}', '${p.project_code}')">
              <i data-lucide="upload" style="width:14px;height:14px"></i> Submit Cut
            </button>
          `}
        `
      });

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error(err);
      Toast.error('Failed to load project details.');
    }
  },

  async acceptProject(projectId) {
    try {
      const res = await API.post(`/projects/${projectId}/accept-assignment`, {});
      Toast.success(res.message || 'Assignment accepted! Status updated to In Progress.');
      await this.loadOverviewData();
    } catch (err) {
      console.error(err);
    }
  },

  inspectFootage(footageUrl) {
    if (!footageUrl) {
      Toast.error('No footage URL provided for this project.');
      return;
    }
    window.location.hash = '#inspector';
    setTimeout(() => {
      const input = document.getElementById('inspect-url-input');
      if (input) {
        input.value = footageUrl;
        const btn = document.getElementById('inspect-submit-btn');
        if (btn) btn.click();
      }
    }, 200);
  }
};

window.EditorPortal = EditorPortal;

