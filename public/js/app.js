/**
 * Application Core Controller & Router
 */

const App = {
  activeRoute: 'overview',
  authView: 'login', // 'login' or 'register'
  registerRole: 'CLIENT', // 'CLIENT' or 'EDITOR'

  setAuthView(view) {
    this.authView = view;
    this.renderLoginScreen();
  },

  setRegisterRole(role) {
    this.registerRole = role;
    this.renderLoginScreen();
  },

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
      document.body.classList.remove('login-mode');
      this.renderSidebar();
      this.renderTopbarUser();
      this.pollNotifications();
    } catch {
      State.currentUser = null;
      document.body.classList.add('login-mode');
      this.renderLoginScreen();
    }
  },

  async logout() {
    try {
      await API.post('/auth/logout');
    } catch (err) {
      console.error(err);
    } finally {
      State.currentUser = null;
      API.setToken(null);
      document.body.classList.add('login-mode');
      Toast.info('Signed out.');
      this.renderLoginScreen();
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
        <a href="#${i.route}" class="nav-item ${this.activeRoute === i.route ? 'active' : ''}" onclick="App.closeMobileSidebar()">
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
        <span class="user-name-text" style="font-size:0.85rem;font-weight:600">${user.name}</span>
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
      if (State.currentUser) {
        window.location.hash = '#overview';
        return;
      }
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
    document.body.classList.add('login-mode');
    const mainContainer = document.getElementById('main-content-view');
    if (!mainContainer) return;

    if (this.authView === 'register') {
      mainContainer.innerHTML = `
        <div class="login-card-container register-card-container">
          <div style="text-align:center;margin-bottom:20px">
            <div class="logo-badge" style="margin:0 auto 12px;width:52px;height:52px;background:linear-gradient(135deg,var(--accent-primary),var(--accent-secondary));display:flex;align-items:center;justify-content:center;border-radius:16px;color:#fff;box-shadow:0 8px 24px rgba(37,99,235,0.35)">
              <i data-lucide="user-plus" style="width:26px;height:26px"></i>
            </div>
            <h2 style="font-size:1.45rem;font-weight:800;letter-spacing:-0.025em;color:var(--text-primary)">Create Account</h2>
            <p style="font-size:0.85rem;color:var(--text-muted);margin-top:4px">Join CineFlow Studio Platform</p>
          </div>

          <!-- Role Selector Segmented Controls -->
          <div class="auth-role-tabs">
            <button type="button" class="auth-role-tab ${this.registerRole === 'CLIENT' ? 'active' : ''}" id="role-tab-client">
              <i data-lucide="briefcase" style="width:16px;height:16px"></i>
              <span>Client</span>
            </button>
            <button type="button" class="auth-role-tab ${this.registerRole === 'EDITOR' ? 'active' : ''}" id="role-tab-editor">
              <i data-lucide="scissors" style="width:16px;height:16px"></i>
              <span>Video Editor</span>
            </button>
          </div>

          <div class="register-form-box">
            ${this.registerRole === 'CLIENT' ? `
              <div class="form-group" style="margin-bottom:14px">
                <label class="form-label" style="display:block;margin-bottom:5px;font-weight:600;font-size:0.82rem;color:var(--text-secondary)">Full Name *</label>
                <input type="text" id="reg-name" class="form-control" placeholder="e.g. Sarah Jenkins" autocomplete="name" required style="width:100%;height:46px;padding:0 14px;border-radius:var(--radius-md);font-size:1rem">
              </div>
              <div class="form-group" style="margin-bottom:14px">
                <label class="form-label" style="display:block;margin-bottom:5px;font-weight:600;font-size:0.82rem;color:var(--text-secondary)">Work Email *</label>
                <input type="email" id="reg-email" class="form-control" placeholder="sarah@company.com" autocapitalize="none" autocorrect="off" autocomplete="email" required style="width:100%;height:46px;padding:0 14px;border-radius:var(--radius-md);font-size:1rem">
              </div>
              <div class="form-group" style="margin-bottom:14px">
                <label class="form-label" style="display:block;margin-bottom:5px;font-weight:600;font-size:0.82rem;color:var(--text-secondary)">Company / Channel Name *</label>
                <input type="text" id="reg-company" class="form-control" placeholder="e.g. Apex Media or TechWithSarah" required style="width:100%;height:46px;padding:0 14px;border-radius:var(--radius-md);font-size:1rem">
              </div>
              <div class="form-group" style="margin-bottom:14px">
                <label class="form-label" style="display:block;margin-bottom:5px;font-weight:600;font-size:0.82rem;color:var(--text-secondary)">Phone / WhatsApp Number *</label>
                <input type="tel" id="reg-phone" class="form-control" placeholder="+1 (555) 019-2834" autocomplete="tel" required style="width:100%;height:46px;padding:0 14px;border-radius:var(--radius-md);font-size:1rem">
              </div>
              <div class="form-group" style="margin-bottom:20px">
                <label class="form-label" style="display:block;margin-bottom:5px;font-weight:600;font-size:0.82rem;color:var(--text-secondary)">Password * (min. 6 characters)</label>
                <input type="password" id="reg-password" class="form-control" placeholder="••••••••" autocomplete="new-password" required style="width:100%;height:46px;padding:0 14px;border-radius:var(--radius-md);font-size:1rem">
              </div>
              <button type="button" id="reg-submit-btn" class="btn btn-primary" style="width:100%;height:48px;font-size:1rem;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:var(--radius-md);box-shadow:0 4px 14px rgba(37,99,235,0.3)">
                Register as Client
              </button>
            ` : `
              <div class="form-group" style="margin-bottom:14px">
                <label class="form-label" style="display:block;margin-bottom:5px;font-weight:600;font-size:0.82rem;color:var(--text-secondary)">Full Name *</label>
                <input type="text" id="reg-name" class="form-control" placeholder="e.g. David Ross" autocomplete="name" required style="width:100%;height:46px;padding:0 14px;border-radius:var(--radius-md);font-size:1rem">
              </div>
              <div class="form-group" style="margin-bottom:14px">
                <label class="form-label" style="display:block;margin-bottom:5px;font-weight:600;font-size:0.82rem;color:var(--text-secondary)">Email Address *</label>
                <input type="email" id="reg-email" class="form-control" placeholder="david@editorpro.com" autocapitalize="none" autocorrect="off" autocomplete="email" required style="width:100%;height:46px;padding:0 14px;border-radius:var(--radius-md);font-size:1rem">
              </div>
              <div class="form-group" style="margin-bottom:14px">
                <label class="form-label" style="display:block;margin-bottom:5px;font-weight:600;font-size:0.82rem;color:var(--text-secondary)">Phone / WhatsApp Number *</label>
                <input type="tel" id="reg-phone" class="form-control" placeholder="+1 (555) 019-2834" autocomplete="tel" required style="width:100%;height:46px;padding:0 14px;border-radius:var(--radius-md);font-size:1rem">
              </div>
              <div class="form-group" style="margin-bottom:14px">
                <label class="form-label" style="display:block;margin-bottom:5px;font-weight:600;font-size:0.82rem;color:var(--text-secondary)">Portfolio / Showreel Link *</label>
                <input type="url" id="reg-portfolio" class="form-control" placeholder="https://vimeo.com/... or YouTube / Drive link" required style="width:100%;height:46px;padding:0 14px;border-radius:var(--radius-md);font-size:1rem">
              </div>
              <div class="form-group" style="margin-bottom:14px">
                <label class="form-label" style="display:block;margin-bottom:5px;font-weight:600;font-size:0.82rem;color:var(--text-secondary)">Primary Software / Tools *</label>
                <input type="text" id="reg-skills" class="form-control" placeholder="e.g. Premiere Pro, After Effects, DaVinci Resolve" required style="width:100%;height:46px;padding:0 14px;border-radius:var(--radius-md);font-size:1rem">
              </div>
              <div class="form-group" style="margin-bottom:20px">
                <label class="form-label" style="display:block;margin-bottom:5px;font-weight:600;font-size:0.82rem;color:var(--text-secondary)">Password * (min. 6 characters)</label>
                <input type="password" id="reg-password" class="form-control" placeholder="••••••••" autocomplete="new-password" required style="width:100%;height:46px;padding:0 14px;border-radius:var(--radius-md);font-size:1rem">
              </div>
              <button type="button" id="reg-submit-btn" class="btn btn-primary" style="width:100%;height:48px;font-size:1rem;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:var(--radius-md);box-shadow:0 4px 14px rgba(37,99,235,0.3)">
                Register as Editor
              </button>
            `}
          </div>

          <div style="margin-top:20px;text-align:center">
            <button type="button" id="switch-to-login-btn" class="auth-switch-link">
              Already have an account? <span>Sign In here →</span>
            </button>
          </div>

          <div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--border-color);display:flex;align-items:center;justify-content:center;gap:6px;font-size:0.75rem;color:var(--text-muted)">
            <i data-lucide="shield-check" style="width:14px;height:14px;color:var(--accent-success)"></i>
            <span>Direct & Confidential Onboarding</span>
          </div>
        </div>
      `;

      // Event bindings for register screen
      const roleTabClient = document.getElementById('role-tab-client');
      const roleTabEditor = document.getElementById('role-tab-editor');
      if (roleTabClient) roleTabClient.onclick = () => App.setRegisterRole('CLIENT');
      if (roleTabEditor) roleTabEditor.onclick = () => App.setRegisterRole('EDITOR');

      const switchToLoginBtn = document.getElementById('switch-to-login-btn');
      if (switchToLoginBtn) switchToLoginBtn.onclick = () => App.setAuthView('login');

      const regSubmitBtn = document.getElementById('reg-submit-btn');
      if (regSubmitBtn) {
        regSubmitBtn.onclick = (e) => App.handleRegisterForm(e);
        regSubmitBtn.addEventListener('click', (e) => App.handleRegisterForm(e));
      }

      const regInputs = mainContainer.querySelectorAll('.register-form-box input');
      regInputs.forEach(inp => {
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') App.handleRegisterForm(e);
        });
      });

    } else {
      // Default: Sign In view
      mainContainer.innerHTML = `
        <div class="login-card-container">
          <div style="text-align:center;margin-bottom:28px">
            <div class="logo-badge" style="margin:0 auto 14px;width:56px;height:56px;background:linear-gradient(135deg,var(--accent-primary),var(--accent-secondary));display:flex;align-items:center;justify-content:center;border-radius:16px;color:#fff;box-shadow:0 8px 24px rgba(37,99,235,0.35)">
              <i data-lucide="video" style="width:28px;height:28px"></i>
            </div>
            <h2 style="font-size:1.55rem;font-weight:800;letter-spacing:-0.025em;color:var(--text-primary)">CineFlow Studio</h2>
            <p style="font-size:0.875rem;color:var(--text-muted);margin-top:6px">Video Editing Agency Management Platform</p>
          </div>

          <div class="login-form-box">
            <div class="form-group" style="margin-bottom:18px">
              <label class="form-label" style="display:block;margin-bottom:7px;font-weight:600;font-size:0.85rem;color:var(--text-secondary)">Email Address</label>
              <input type="email" id="login-email" class="form-control" placeholder="name@company.com" autocapitalize="none" autocorrect="off" autocomplete="email" required style="width:100%;height:48px;padding:0 14px;border-radius:var(--radius-md);font-size:1rem">
            </div>
            <div class="form-group" style="margin-bottom:24px">
              <label class="form-label" style="display:block;margin-bottom:7px;font-weight:600;font-size:0.85rem;color:var(--text-secondary)">Password</label>
              <input type="password" id="login-password" class="form-control" placeholder="••••••••" autocomplete="current-password" required style="width:100%;height:48px;padding:0 14px;border-radius:var(--radius-md);font-size:1rem">
            </div>
            <button type="button" id="login-submit-btn" class="btn btn-primary" style="width:100%;height:48px;font-size:1rem;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:var(--radius-md);box-shadow:0 4px 14px rgba(37,99,235,0.3)">
              Sign In
            </button>
          </div>

          <div style="margin-top:20px;text-align:center">
            <button type="button" id="switch-to-register-btn" class="auth-switch-link">
              Don't have an account? <span>Register as Client or Editor →</span>
            </button>
          </div>

          <div style="margin-top:28px;padding-top:18px;border-top:1px solid var(--border-color);display:flex;align-items:center;justify-content:center;gap:6px;font-size:0.75rem;color:var(--text-muted)">
            <i data-lucide="shield-check" style="width:14px;height:14px;color:var(--accent-success)"></i>
            <span>256-Bit Encrypted Client & Partner Portal</span>
          </div>
        </div>
      `;

      // Direct DOM event bindings for login
      const submitBtn = document.getElementById('login-submit-btn');
      if (submitBtn) {
        submitBtn.onclick = (e) => App.handleLoginForm(e);
        submitBtn.addEventListener('click', (e) => App.handleLoginForm(e));
      }

      const switchToRegisterBtn = document.getElementById('switch-to-register-btn');
      if (switchToRegisterBtn) switchToRegisterBtn.onclick = () => App.setAuthView('register');

      const emailInp = document.getElementById('login-email');
      const passInp = document.getElementById('login-password');
      [emailInp, passInp].forEach(inp => {
        if (inp) {
          inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') App.handleLoginForm(e);
          });
        }
      });
    }

    if (window.lucide) window.lucide.createIcons();
  },

  async handleLoginForm(e) {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    const email = document.getElementById('login-email')?.value?.trim().toLowerCase();
    const password = document.getElementById('login-password')?.value;

    if (!email || !password) {
      Toast.error('Please enter both email and password.');
      return;
    }

    const btn = document.getElementById('login-submit-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Signing In...';
    }

    try {
      const res = await API.post('/auth/login', { email, password });
      if (res.token) {
        API.setToken(res.token);
      }
      State.currentUser = res.user;
      document.body.classList.remove('login-mode');
      Toast.success(`Welcome back, ${res.user.name}!`);
      this.renderSidebar();
      this.renderTopbarUser();
      
      if (window.location.hash === '#overview') {
        this.handleRouting();
      } else {
        window.location.hash = '#overview';
      }
    } catch (err) {
      console.error('Login error:', err);
      Toast.error(err.message || 'Login failed. Please check credentials.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'Sign In';
      }
    }
  },

  async handleRegisterForm(e) {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    const name = document.getElementById('reg-name')?.value?.trim();
    const email = document.getElementById('reg-email')?.value?.trim().toLowerCase();
    const phone = document.getElementById('reg-phone')?.value?.trim();
    const password = document.getElementById('reg-password')?.value;

    if (!name || !email || !password || !phone) {
      Toast.error('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      Toast.error('Password must be at least 6 characters long.');
      return;
    }

    const payload = {
      role: this.registerRole,
      name,
      email,
      phone,
      password
    };

    if (this.registerRole === 'CLIENT') {
      const company_name = document.getElementById('reg-company')?.value?.trim();
      if (!company_name) {
        Toast.error('Please enter your company or channel name.');
        return;
      }
      payload.company_name = company_name;
    } else if (this.registerRole === 'EDITOR') {
      const portfolio_link = document.getElementById('reg-portfolio')?.value?.trim();
      const skills = document.getElementById('reg-skills')?.value?.trim();
      if (!portfolio_link) {
        Toast.error('Please enter your portfolio or showreel link.');
        return;
      }
      if (!skills) {
        Toast.error('Please specify your primary software or tools.');
        return;
      }
      payload.portfolio_link = portfolio_link;
      payload.skills = skills;
    }

    const btn = document.getElementById('reg-submit-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Creating Account...';
    }

    try {
      const res = await API.post('/auth/register', payload);
      if (res.token) {
        API.setToken(res.token);
      }
      State.currentUser = res.user;
      document.body.classList.remove('login-mode');
      this.authView = 'login'; // Reset for next sign-in session
      Toast.success(res.message || `Welcome to CineFlow Studio, ${res.user.name}!`);
      this.renderSidebar();
      this.renderTopbarUser();

      if (window.location.hash === '#overview') {
        this.handleRouting();
      } else {
        window.location.hash = '#overview';
      }
    } catch (err) {
      console.error('Registration error:', err);
      Toast.error(err.message || 'Registration failed. Please check your details.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = this.registerRole === 'CLIENT' ? 'Register as Client' : 'Register as Editor';
      }
    }
  },

  toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop-el');
    if (sidebar) {
      const isOpen = sidebar.classList.toggle('mobile-open');
      if (backdrop) {
        backdrop.classList.toggle('active', isOpen);
      }
    }
  },

  closeMobileSidebar() {
    document.querySelector('.sidebar')?.classList.remove('mobile-open');
    document.getElementById('sidebar-backdrop-el')?.classList.remove('active');
  }
};

window.App = App;

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

