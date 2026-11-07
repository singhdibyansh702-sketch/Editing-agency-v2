/**
 * Agency Chat View
 * Role-segregated messaging:
 * - Admin: Two-tab inbox (Clients & Editors)
 * - Client: Direct coordination strictly with Admin
 * - Editor: Direct coordination strictly with Admin
 * - Direct Client <-> Editor messaging is physically impossible and API blocked (403)
 */

const ChatView = {
  activeTab: 'clients', // 'clients' or 'editors' for Admin
  activeRecipientId: null,
  activeRecipientName: '',
  pollInterval: null,

  async render(container) {
    const user = State.currentUser;

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div>
          <h1 class="page-title">Agency Communication Channel</h1>
          <p class="card-subtitle">
            ${user.role === 'ADMIN' ? 'Two-tab segregated communication bridge for clients and editing team.' : 'Direct confidential communication channel with Agency Administration.'}
          </p>
        </div>
      </div>

      <div class="chat-container">
        <!-- Chat Sidebar -->
        <div class="chat-sidebar" id="chat-sidebar-el">
          ${user.role === 'ADMIN' ? `
            <div class="chat-tabs">
              <button class="chat-tab ${this.activeTab === 'clients' ? 'active' : ''}" id="tab-clients" onclick="ChatView.switchAdminTab('clients')">
                <i data-lucide="users" style="width:14px;height:14px;display:inline;vertical-align:middle;margin-right:4px"></i> Clients
                <span class="chat-tab-badge" id="tab-clients-badge" style="display:none">0</span>
              </button>
              <button class="chat-tab ${this.activeTab === 'editors' ? 'active' : ''}" id="tab-editors" onclick="ChatView.switchAdminTab('editors')">
                <i data-lucide="film" style="width:14px;height:14px;display:inline;vertical-align:middle;margin-right:4px"></i> Editors
                <span class="chat-tab-badge" id="tab-editors-badge" style="display:none">0</span>
              </button>
            </div>
          ` : `
            <div style="padding:16px;border-bottom:1px solid var(--border-color);font-weight:700;font-size:0.95rem;display:flex;align-items:center;gap:8px">
              <i data-lucide="shield-check" style="color:var(--accent-primary);width:18px;height:18px"></i> Direct Support
            </div>
          `}
          <div class="chat-user-list" id="chat-user-list-el">
            <div style="text-align:center;padding:20px;color:var(--text-muted)">Loading conversations...</div>
          </div>
        </div>

        <!-- Chat Conversation Area -->
        <div class="chat-main">
          <div class="chat-header" id="chat-header-el">
            <div style="display:flex;align-items:center;gap:10px">
              <button class="mobile-chat-back-btn" onclick="ChatView.backToContactList()" title="Back to contacts">
                <i data-lucide="arrow-left" style="width:16px;height:16px"></i>
              </button>
              <div class="user-avatar" id="chat-active-avatar" style="width:34px;height:34px;font-size:0.8rem">AG</div>
              <div>
                <div style="font-weight:700;font-size:0.95rem" id="chat-active-name">Select a conversation</div>
                <div style="font-size:0.75rem;color:var(--text-muted)" id="chat-active-role">Confidential messaging</div>
              </div>
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);display:flex;align-items:center;gap:4px">
              <span style="width:8px;height:8px;border-radius:50%;background-color:var(--accent-success);display:inline-block"></span>
              Encrypted Channel
            </div>
          </div>

          <div class="chat-messages" id="chat-messages-el">
            <div style="text-align:center;margin:auto;color:var(--text-muted)">
              <i data-lucide="message-square" style="width:40px;height:40px;margin-bottom:8px"></i>
              <p>Select a contact to view or send messages.</p>
            </div>
          </div>

          <div class="chat-input-bar">
            <input type="text" id="chat-msg-input" class="form-control" placeholder="Type a message to agency..." onkeydown="if(event.key === 'Enter') ChatView.sendMessage()">
            <button class="btn btn-primary" onclick="ChatView.sendMessage()" style="flex-shrink:0">
              <i data-lucide="send" style="width:16px;height:16px"></i> Send
            </button>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    await this.loadConversations();

    // Start poll for live incoming chat
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      if (this.activeRecipientId) {
        this.loadMessages(this.activeRecipientId, false);
      }
    }, 4000);
  },

  switchAdminTab(tab) {
    this.activeTab = tab;
    document.getElementById('tab-clients')?.classList.toggle('active', tab === 'clients');
    document.getElementById('tab-editors')?.classList.toggle('active', tab === 'editors');
    this.loadConversations();
  },

  async loadConversations() {
    try {
      const res = await API.get('/chat/conversations');
      const listEl = document.getElementById('chat-user-list-el');
      if (!listEl) return;

      const user = State.currentUser;

      if (user.role === 'ADMIN') {
        const conversations = res.conversations || { clients: [], editors: [] };
        const activeList = this.activeTab === 'clients' ? conversations.clients : conversations.editors;

        if (!activeList || activeList.length === 0) {
          listEl.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted)">No active ${this.activeTab} found.</div>`;
          return;
        }

        listEl.innerHTML = activeList.map(item => `
          <div class="chat-user-item ${this.activeRecipientId === item.id ? 'active' : ''}" onclick="ChatView.selectConversation('${item.id}', '${item.name}', '${item.role}')">
            <div class="user-avatar" style="width:34px;height:34px;font-size:0.8rem">
              ${item.name.substring(0, 2).toUpperCase()}
            </div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-weight:600;font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.name}</span>
                ${item.unread_count > 0 ? `<span class="chat-user-unread-badge">${item.unread_count}</span>` : ''}
              </div>
              <div style="font-size:0.76rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">
                ${item.last_message || 'Start conversation...'}
              </div>
            </div>
          </div>
        `).join('');

        // Select first if none selected
        if (!this.activeRecipientId && activeList.length > 0) {
          this.selectConversation(activeList[0].id, activeList[0].name, activeList[0].role);
        }
      } else {
        // Client or Editor: Only 1 contact (Admin)
        const contacts = res.conversations || [];
        if (contacts.length === 0) {
          listEl.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted)">Agency Admin not available.</div>`;
          return;
        }

        const admin = contacts[0];
        listEl.innerHTML = `
          <div class="chat-user-item active" onclick="ChatView.selectConversation('${admin.id}', '${admin.name}', 'ADMIN')">
            <div class="user-avatar" style="width:34px;height:34px;font-size:0.8rem">AG</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-weight:600;font-size:0.88rem">Agency Support & Admin</span>
                ${admin.unread_count > 0 ? `<span class="chat-user-unread-badge">${admin.unread_count}</span>` : ''}
              </div>
              <div style="font-size:0.76rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">
                ${admin.last_message || 'Direct agency communication'}
              </div>
            </div>
          </div>
        `;

        if (!this.activeRecipientId) {
          this.selectConversation(admin.id, admin.name, 'ADMIN');
        }
      }

      if (window.App && App.pollChatUnread) {
        App.pollChatUnread();
      }
    } catch (err) {
      console.error(err);
    }
  },

  selectConversation(userId, userName, role) {
    this.activeRecipientId = userId;
    this.activeRecipientName = userName;

    const nameEl = document.getElementById('chat-active-name');
    const roleEl = document.getElementById('chat-active-role');
    const avatarEl = document.getElementById('chat-active-avatar');

    if (nameEl) nameEl.textContent = userName;
    if (roleEl) roleEl.textContent = `Direct confidential message with ${role}`;
    if (avatarEl) avatarEl.textContent = userName.substring(0, 2).toUpperCase();

    // Highlight in list
    document.querySelectorAll('.chat-user-item').forEach(el => el.classList.remove('active'));

    // On mobile, show messages panel
    document.querySelector('.chat-container')?.classList.add('mobile-messages-active');

    this.loadMessages(userId, true);
  },

  backToContactList() {
    document.querySelector('.chat-container')?.classList.remove('mobile-messages-active');
  },

  async loadMessages(userId, scrollToBottom = true) {
    try {
      const res = await API.get(`/chat/messages/${userId}`);
      const messages = res.messages || [];
      const messagesEl = document.getElementById('chat-messages-el');
      if (!messagesEl) return;

      if (messages.length === 0) {
        messagesEl.innerHTML = `
          <div style="text-align:center;margin:auto;color:var(--text-muted)">
            <p>No messages yet. Send a message to start direct coordination.</p>
          </div>
        `;
        return;
      }

      const myId = State.currentUser?.id;

      messagesEl.innerHTML = messages.map(m => {
        const isSent = m.sender_id === myId;
        return `
          <div class="chat-bubble ${isSent ? 'sent' : 'received'}">
            ${m.project_code ? `
              <div style="font-size:0.72rem;font-weight:700;opacity:0.8;margin-bottom:4px">
                RE: ${m.project_code} - ${m.project_title || ''}
              </div>
            ` : ''}
            <div>${m.message}</div>
            <div class="chat-bubble-time">${State.formatDateTime(m.created_at)}</div>
          </div>
        `;
      }).join('');

      if (scrollToBottom) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }

      // Refresh global badge since messages in this thread were marked read
      if (window.App && App.pollChatUnread) {
        App.pollChatUnread();
      }
    } catch (err) {
      console.error(err);
    }
  },

  updateTabBadges(byTab) {
    if (!byTab) return;
    const clientsBadge = document.getElementById('tab-clients-badge');
    if (clientsBadge) {
      if (byTab.clients > 0) {
        clientsBadge.style.display = 'inline-flex';
        clientsBadge.textContent = byTab.clients_senders > 1 ? `${byTab.clients_senders}` : `${byTab.clients}`;
        clientsBadge.title = `${byTab.clients} unread from ${byTab.clients_senders} client${byTab.clients_senders > 1 ? 's' : ''}`;
      } else {
        clientsBadge.style.display = 'none';
      }
    }

    const editorsBadge = document.getElementById('tab-editors-badge');
    if (editorsBadge) {
      if (byTab.editors > 0) {
        editorsBadge.style.display = 'inline-flex';
        editorsBadge.textContent = byTab.editors_senders > 1 ? `${byTab.editors_senders}` : `${byTab.editors}`;
        editorsBadge.title = `${byTab.editors} unread from ${byTab.editors_senders} editor${byTab.editors_senders > 1 ? 's' : ''}`;
      } else {
        editorsBadge.style.display = 'none';
      }
    }
  },

  async sendMessage() {
    const input = document.getElementById('chat-msg-input');
    const message = input?.value?.trim();

    if (!message || !this.activeRecipientId) return;

    try {
      await API.post('/chat/send', {
        receiver_id: this.activeRecipientId,
        message
      });

      input.value = '';
      await this.loadMessages(this.activeRecipientId, true);

      if (window.App && App.pollChatUnread) {
        App.pollChatUnread();
      }
    } catch (err) {
      console.error(err);
    }
  }
};

window.ChatView = ChatView;

