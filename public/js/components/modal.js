/**
 * Accessible Modal System
 */

const Modal = {
  backdrop: null,
  dialog: null,
  activeCallback: null,

  init() {
    this.backdrop = document.getElementById('global-modal-backdrop');
    if (!this.backdrop) {
      this.backdrop = document.createElement('div');
      this.backdrop.id = 'global-modal-backdrop';
      this.backdrop.className = 'modal-backdrop';
      this.backdrop.innerHTML = `
        <div class="modal-dialog" id="global-modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title" id="global-modal-title">Modal Title</h3>
            <button class="modal-close-btn" onclick="Modal.close()">&times;</button>
          </div>
          <div class="modal-body" id="global-modal-body"></div>
          <div class="modal-footer" id="global-modal-footer"></div>
        </div>
      `;
      document.body.appendChild(this.backdrop);

      // Close on backdrop click outside dialog
      this.backdrop.addEventListener('click', (e) => {
        if (e.target === this.backdrop) {
          Modal.close();
        }
      });

      // Close on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.backdrop.classList.contains('open')) {
          Modal.close();
        }
      });
    }
    this.dialog = document.getElementById('global-modal-dialog');
  },

  open({ title, bodyHtml, footerHtml = '', size = 'md', onRender = null }) {
    if (!this.backdrop) this.init();

    document.getElementById('global-modal-title').textContent = title || 'Agency Dialog';
    document.getElementById('global-modal-body').innerHTML = bodyHtml || '';
    
    const footerEl = document.getElementById('global-modal-footer');
    if (footerHtml) {
      footerEl.innerHTML = footerHtml;
      footerEl.style.display = 'flex';
    } else {
      footerEl.innerHTML = '';
      footerEl.style.display = 'none';
    }

    if (size === 'lg') {
      this.dialog.className = 'modal-dialog modal-dialog-lg';
    } else {
      this.dialog.className = 'modal-dialog';
    }

    this.backdrop.classList.add('open');

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }

    if (typeof onRender === 'function') {
      setTimeout(() => onRender(this.dialog), 10);
    }
  },

  close() {
    if (this.backdrop) {
      this.backdrop.classList.remove('open');
    }
  }
};

window.Modal = Modal;

