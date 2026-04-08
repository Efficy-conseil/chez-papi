// ── PWA INITIALIZATION ──

// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => {
    console.log('Service Worker registration failed:', err);
  });
}

// ── PWA INSTALL BANNER ──

let deferredPrompt;
const installBanner = document.getElementById('pwa-install-banner');
const installBtn = document.getElementById('pwa-install-btn');
const dismissBtn = document.getElementById('pwa-dismiss-btn');

// Listen for beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();

  // Stash the event so it can be triggered later
  deferredPrompt = e;

  // Show the install banner (on mobile only)
  if (window.innerWidth < 900) {
    showInstallBanner();
  }
});

function showInstallBanner() {
  installBanner.style.display = 'block';

  // Adjust bottom padding when banner visible
  document.querySelector('.content').style.paddingBottom = (60 + 80) + 'px';
}

function hideInstallBanner() {
  installBanner.style.display = 'none';
  document.querySelector('.content').style.paddingBottom = '60px';
}

// Install button click
installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  console.log(`User response to the install prompt: ${outcome}`);

  // We've used the prompt, and can't use it again
  deferredPrompt = null;

  hideInstallBanner();
});

// Dismiss button
dismissBtn.addEventListener('click', () => {
  deferredPrompt = null;
  hideInstallBanner();
});

// Detect if app is installed
window.addEventListener('appinstalled', () => {
  console.log('PWA was installed');
  hideInstallBanner();
});

// ── SIDEBAR MOBILE TOGGLE ──

const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const menuBtn = document.getElementById('menu-btn');
const sidebarClose = document.querySelector('.sidebar-close');

function toggleSidebar() {
  sidebar.classList.toggle('open');
  sidebarOverlay.classList.toggle('open');
}

menuBtn.addEventListener('click', toggleSidebar);
sidebarClose.addEventListener('click', toggleSidebar);

// Close sidebar when clicking nav item (mobile)
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    if (window.innerWidth < 900) {
      setTimeout(() => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('open');
      }, 100);
    }
  });
});

// ── PANEL NAVIGATION ──

function showPanel(panelName, element) {
  // Hide all panels
  document.querySelectorAll('.panel').forEach(p => {
    p.classList.remove('active');
  });

  // Remove active from all nav items
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('active');
  });

  // Show selected panel
  const panel = document.getElementById('panel-' + panelName);
  if (panel) {
    panel.classList.add('active');
  }

  // Highlight nav item
  if (element) {
    element.classList.add('active');
  }

  // Scroll to top
  document.querySelector('.content').scrollTop = 0;
}

// ── DATE INITIALIZATION REMOVED ──

// ── RESPONSIVE HANDLING ──

let isDesktop = window.innerWidth >= 900;

window.addEventListener('resize', () => {
  const newIsDesktop = window.innerWidth >= 900;

  if (newIsDesktop !== isDesktop) {
    isDesktop = newIsDesktop;

    // Close sidebar on resize to desktop
    if (isDesktop) {
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('open');
    }

  }
});

// ── API HELPERS (for future backend integration) ──

const API = {
  baseURL: '', // Will be set to your Antigravity backend URL

  async getEvents() {
    if (!this.baseURL) return [];
    try {
      const res = await fetch(`${this.baseURL}/api/evenements`);
      return await res.json();
    } catch (err) {
      console.error('Failed to fetch events:', err);
      return [];
    }
  },

  async getClients() {
    if (!this.baseURL) return [];
    try {
      const res = await fetch(`${this.baseURL}/api/clients`);
      return await res.json();
    } catch (err) {
      console.error('Failed to fetch clients:', err);
      return [];
    }
  },

  async createDevis(data) {
    if (!this.baseURL) {
      // Fallback: save to local storage
      const drafts = JSON.parse(localStorage.getItem('devis_drafts') || '[]');
      drafts.push({
        ...data,
        id: 'DRAFT_' + Date.now(),
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('devis_drafts', JSON.stringify(drafts));
      return { success: true, offline: true };
    }

    try {
      const res = await fetch(`${this.baseURL}/api/devis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (err) {
      console.error('Failed to create devis:', err);
      // Fallback to local storage
      return this.createDevis(data);
    }
  }
};

// ── LOCAL STORAGE HELPERS ──

const Storage = {
  getEventCache() {
    return JSON.parse(localStorage.getItem('events_cache') || '[]');
  },

  setEventCache(events) {
    localStorage.setItem('events_cache', JSON.stringify(events));
  },

  getDevisDrafts() {
    return JSON.parse(localStorage.getItem('devis_drafts') || '[]');
  },

  addDevisDraft(devis) {
    const drafts = this.getDevisDrafts();
    drafts.push({
      ...devis,
      id: 'DRAFT_' + Date.now(),
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('devis_drafts', JSON.stringify(drafts));
  },

  clearDevisDrafts() {
    localStorage.removeItem('devis_drafts');
  }
};

// ── NOTIFICATION HELPERS ──

function showNotification(message, type = 'info', duration = 3000) {
  // Create notification element
  const notif = document.createElement('div');
  notif.style.cssText = `position: fixed; bottom: 80px; left: 12px; right: 12px; background: #2E2018; color: #fff; padding: 14px 16px; border-radius: 6px; font-size: 13px; z-index: 300; box-shadow: 0 4px 12px rgba(0,0,0,.2); animation: slideUp .3s ease-out;`;

  if (type === 'success') {
    notif.style.background = '#4A6741';
  } else if (type === 'error') {
    notif.style.background = '#C0453A';
  }

  notif.textContent = message;
  document.body.appendChild(notif);

  setTimeout(() => {
    notif.style.animation = 'slideDown .3s ease-out';
    setTimeout(() => notif.remove(), 300);
  }, duration);
}

// ── EXPORT FOR TESTING ──

window.ChezPapi = {
  API,
  Storage,
  showPanel,
  toggleSidebar,
  showNotification
};

console.log('Chez Papi PWA initialized ✓');
