/**
 * Application Core Controller & Router
 */

const App = {
  activeRoute: 'overview',

  async init() {
    this.initTheme();
    Toast.init();
    Modal.init();

    // Check user session
    await this.checkAuth();

    // Handle hash routing
    window.addEventListener('hashchange', () => this.handleRouting());
    this.handleRouting();

    // Setup notifications periodic poll
    setInterval(() => this.pollNotifications(), 10000);
  },

  // Theme Management (Light & Dark with persistence)
  initTheme() {
    const saved = localStorage.getItem('agency_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    this.updateThemeButton(saved);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('agency_theme', next);
    this.updateThemeButton(next);
  },

  updateThemeButton(theme) {
    const iconEl = document.getElementById('theme-icon');
    if (iconEl) {
      iconEl.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
      if (window.lucide) window.lucide.createIcons();
    }
  },

  // Authentication check
  async checkAuth() {
    try {
      const res = await API.get('/auth/me');
      State.currentUser = res.user;
      this.renderSidebar();
      this.renderTopbarUser();
      this.pollNotifications();
    } catch {
      State.currentUser = null;
      this.renderLoginScreen();
    }
  },

  async logout() {
    try {
      await API.post('/auth/logout');
      State.currentUser = null;
      Toast.info('Signed out.');
      this.renderLoginScreen();
    } catch (err) {
      console.error(err);
    }
  },

  renderSidebar() {
    const user = State.currentUser;
    if (!user) return;

    const navEl = document.getElementById('sidebar-nav-el');
    if (!navEl) return;

    let items = [];

    if (user.role === 'ADMIN') {
      items = [
        { route: 'overview', icon: 'layout-dashboard', label: 'Command Center' },
        { route: 'projects', icon: 'film', label: 'Project Pipeline' },
        { route: 'clients', icon: 'users', label: 'Clients Roster' },
        { route: 'editors', icon: 'scissors', label: 'Editors Roster' },
        { route: 'finance', icon: 'wallet', label: 'Finances & Ledger' },
        { route: 'chat', icon: 'message-square', label: 'Agency Chat' },
        { route: 'inspector', icon: 'activity', label: 'Video Inspector' },
        { route: 'audit', icon: 'shield-alert', label: 'Security Audit' },
      ];
    } else if (user.role === 'EDITOR') {
      items = [
        { route: 'overview', icon: 'scissors', label: 'Production Hub' },
        { route: 'chat', icon: 'message-square', label: 'Agency Chat' },
        { route: 'inspector', icon: 'activity', label: 'Video Inspector' },
      ];
    } else if (user.role === 'CLIENT') {
      items = [
        { route: 'overview', icon: 'video', label: 'My Video Orders' },
        { route: 'chat', icon: 'message-square', label: 'Admin Chat' },
        { route: 'inspector', icon: 'activity', label: 'Video Inspector' },
      ];
    }

    navEl.innerHTML = `
      <div class="nav-section-title">Navigation (${user.role})</div>
      ${items.map(i => `
        <a href="#${i.route}" class="nav-item ${this.activeRoute === i.route ? 'active' : ''}">
          <i data-lucide="${i.icon}" style="width:18px;height:18px"></i>
          <span>${i.label}</span>
        </a>
      `).join('')}
    `;

    // Sidebar footer user card
    const userCard = document.getElementById('sidebar-user-card');
    if (userCard) {
      userCard.innerHTML = `
        <div class="user-avatar">${user.name.substring(0, 2).toUpperCase()}</div>
        <div class="user-details">
          <div class="user-name">${user.name}</div>
          <div class="user-role-tag">${user.role}</div>
        </div>
      `;
    }

    if (window.lucide) window.lucide.createIcons();
  },

  renderTopbarUser() {
    const user = State.currentUser;
    if (!user) return;

    const userProfileEl = document.getElementById('topbar-user-badge');
    if (userProfileEl) {
      userProfileEl.innerHTML = `
        <span style="font-size:0.85rem;font-weight:600">${user.name}</span>
        <span class="badge ${user.role === 'ADMIN' ? 'badge-progress' : user.role === 'EDITOR' ? 'badge-review' : 'badge-approved'}" style="font-size:0.7rem">
          ${user.role}
        </span>
      `;
    }
  },

  handleRouting() {
    const hash = window.location.hash.replace('#', '') || 'overview';
    this.activeRoute = hash;

    // Highlight active nav
    document.querySelectorAll('.nav-item').forEach(item => {
      const href = item.getAttribute('href');
      item.classList.toggle('active', href === `#${hash}`);
    });

    const mainContainer = document.getElementById('main-content-view');
    if (!mainContainer) return;

    if (!State.currentUser) {
      this.renderLoginScreen();
      return;
    }

    const role = State.currentUser.role;

    if (hash === 'overview') {
      if (role === 'ADMIN') AdminPortal.renderOverview(mainContainer);
      else if (role === 'EDITOR') EditorPortal.renderOverview(mainContainer);
      else if (role === 'CLIENT') ClientPortal.renderOverview(mainContainer);
    } else if (hash === 'projects') {
      if (role === 'ADMIN') AdminPortal.renderProjects(mainContainer);
      else if (role === 'EDITOR') EditorPortal.renderOverview(mainContainer);
      else if (role === 'CLIENT') ClientPortal.renderOverview(mainContainer);
    } else if (hash === 'clients' && role === 'ADMIN') {
      AdminPortal.renderClients(mainContainer);
    } else if (hash === 'editors' && role === 'ADMIN') {
      AdminPortal.renderEditors(mainContainer);
    } else if (hash === 'finance' && role === 'ADMIN') {
      AdminPortal.renderFinance(mainContainer);
    } else if (hash === 'chat') {
      ChatView.render(mainContainer);
    } else if (hash === 'inspector') {
      VideoInspectorView.render(mainContainer);
    } else if (hash === 'audit' && role === 'ADMIN') {
      AdminPortal.renderAuditLogs(mainContainer);
    } else if (hash === 'login') {
      this.renderLoginScreen();
    } else {
      window.location.hash = '#overview';
    }

    // Close mobile sidebar if open
    document.querySelector('.sidebar')?.classList.remove('mobile-open');
  },

  async pollNotifications() {
    if (!State.currentUser) return;
    try {
      const res = await API.get('/notifications');
      State.notifications = res.notifications || [];
      State.unreadNotifications = res.unread_count || 0;

      const badgeEl = document.getElementById('notification-bell-badge');
      if (badgeEl) {
        badgeEl.style.display = State.unreadNotifications > 0 ? 'block' : 'none';
      }
    } catch {}
  },

  openNotificationsDropdown() {
    const list = State.notifications || [];

    Modal.open({
      title: 'Notifications & Milestone Updates',
      bodyHtml: `
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <button class="btn btn-sm btn-outline" onclick="App.markAllNotificationsRead()">Mark all as read</button>
        </div>
        ${list.length === 0 ? `<p style="text-align:center;color:var(--text-muted);padding:20px">No notifications.</p>` : `
          <div style="display:flex;flex-direction:column;gap:10px;max-height:400px;overflow-y:auto">
            ${list.map(n => `
              <div style="padding:12px;background:var(--bg-tertiary);border-radius:var(--radius-md);border-left:4px solid ${n.is_read ? 'var(--border-color)' : 'var(--accent-primary)'}">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <strong style="font-size:0.9rem">${n.title}</strong>
                  <span style="font-size:0.75rem;color:var(--text-muted)">${State.formatDateTime(n.created_at)}</span>
                </div>
                <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px">${n.message}</div>
              </div>
            `).join('')}
          </div>
        `}
      `,
      footerHtml: `<button class="btn btn-secondary" onclick="Modal.close()">Close</button>`
    });
  },

  async markAllNotificationsRead() {
    try {
      await API.patch('/notifications/all/read');
      State.unreadNotifications = 0;
      const badgeEl = document.getElementById('notification-bell-badge');
      if (badgeEl) badgeEl.style.display = 'none';
      Toast.success('All notifications marked as read.');
      Modal.close();
    } catch (err) {
      console.error(err);
    }
  },

  renderLoginScreen() {
    const mainContainer = document.getElementById('main-content-view');
    if (!mainContainer) return;

    mainContainer.innerHTML = `
      <div style="max-width:440px;margin:60px auto;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-xl);padding:32px;box-shadow:var(--shadow-xl)">
        <div style="text-align:center;margin-bottom:24px">
          <div class="logo-badge" style="margin:0 auto 12px;width:48px;height:48px">
            <i data-lucide="video" style="width:24px;height:24px"></i>
          </div>
          <h2 style="font-size:1.4rem;font-weight:800">CineFlow Management</h2>
          <p style="font-size:0.85rem;color:var(--text-muted);margin-top:4px">Sign in to your agency portal</p>
        </div>

        <form onsubmit="event.preventDefault(); App.handleLoginForm();">
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" id="login-email" class="form-control" placeholder="name@agency.com" required>
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" id="login-password" class="form-control" placeholder="••••••••" required>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;margin-top:10px">
            Sign In
          </button>
        </form>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  },

  async handleLoginForm() {
    const email = document.getElementById('login-email')?.value;
    const password = document.getElementById('login-password')?.value;

    try {
      const res = await API.post('/auth/login', { email, password });
      State.currentUser = res.user;
      Toast.success(`Welcome back, ${res.user.name}!`);
      this.renderSidebar();
      this.renderTopbarUser();
      window.location.hash = '#overview';
    } catch (err) {
      console.error(err);
    }
  },

  toggleMobileSidebar() {
    document.querySelector('.sidebar')?.classList.toggle('mobile-open');
  }
};

window.App = App;

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

