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
                  </div>
                  <div>${State.getStatusBadge(p.status)}</div>
                </div>
              </div>

              ${p.status === 'Revision Required' ? `
                <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:var(--radius-md);padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
                  <i data-lucide="alert-triangle" style="color:var(--accent-danger);width:20px;height:20px;flex-shrink:0"></i>
                  <div style="font-size:0.88rem;color:var(--text-primary)">
                    <strong>Action Required:</strong> Admin has requested revisions on this cut. Please inspect instructions and submit a revised cut.
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
                <button class="btn btn-sm btn-outline" onclick="EditorPortal.inspectFootage('${p.reference_link || ''}')">
                  <i data-lucide="activity" style="width:14px;height:14px"></i> Technical Video Inspector
                </button>

                <div style="display:flex;gap:10px">
                  <button class="btn btn-sm btn-primary" onclick="EditorPortal.openSubmitCutModal('${p.id}', '${p.project_code}')">
                    <i data-lucide="upload" style="width:14px;height:14px"></i> Submit Cut for Review
                  </button>
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

