// ── PWA INITIALIZATION ──

// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => {
    console.log('Service Worker registration failed:', err);
  });
}

// ── PWA INSTALL BANNER ──

const INSTALL_DISMISSED_KEY = 'pwa_install_dismissed_at';
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function wasRecentlyDismissed() {
  const ts = localStorage.getItem(INSTALL_DISMISSED_KEY);
  return ts && (Date.now() - parseInt(ts, 10) < DISMISS_DURATION_MS);
}

function markDismissed() {
  localStorage.setItem(INSTALL_DISMISSED_KEY, Date.now().toString());
}

// ── Android / Chrome: beforeinstallprompt ──

let deferredPrompt;
const installBanner = document.getElementById('pwa-install-banner');
const installBtn = document.getElementById('pwa-install-btn');
const dismissBtn = document.getElementById('pwa-dismiss-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  if (window.innerWidth < 900 && !isInStandaloneMode && !wasRecentlyDismissed()) {
    setTimeout(showInstallBanner, 2000);
  }
});

function showInstallBanner() {
  installBanner.style.display = 'block';
  document.querySelector('.content').style.paddingBottom = (60 + 80) + 'px';
}

function hideInstallBanner() {
  installBanner.style.display = 'none';
  document.querySelector('.content').style.paddingBottom = '60px';
}

installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  hideInstallBanner();
});

dismissBtn.addEventListener('click', () => {
  deferredPrompt = null;
  markDismissed();
  hideInstallBanner();
});

// ── iOS Safari: manual instructions modal ──

const iosModal = document.getElementById('pwa-ios-modal');
const iosDismissBtn = document.getElementById('pwa-ios-dismiss-btn');

function showIOSModal() {
  iosModal.style.display = 'flex';
}

function hideIOSModal() {
  iosModal.style.display = 'none';
}

if (isIOS && !isInStandaloneMode && window.innerWidth < 900 && !wasRecentlyDismissed()) {
  setTimeout(showIOSModal, 2000);
}

iosDismissBtn.addEventListener('click', () => {
  markDismissed();
  hideIOSModal();
});

// ── App installed ──

window.addEventListener('appinstalled', () => {
  hideInstallBanner();
  hideIOSModal();
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

// ── CALENDAR ──

const EVENTS_DATA = [
  { date: '2025-07-01', title: 'Mariage Dupont', detail: 'Mariage · 120 couverts · Grans' },
  { date: '2025-07-05', title: 'Anniversaire Famille Martin', detail: 'Buffet · 45 couverts · Grans' },
  { date: '2025-07-12', title: 'Séminaire SAS Prova BTP', detail: 'Cocktail déj. · 28 pers. · Salon' },
  { date: '2025-07-19', title: 'Réception Mairie de Grans', detail: 'Cocktail dînatoire · 80 couverts' },
  { date: '2025-07-26', title: 'Mariage Dupont (final)', detail: '120 couverts · Livraison incluse' },
  { date: '2025-08-15', title: 'Baptême Famille Bertrand', detail: 'Cocktail · ~40 pers.' },
  { date: '2025-08-22', title: 'CE Airbus', detail: "Repas d'équipe · 50 pers." },
  { date: '2025-09-06', title: 'Repas Famille Rousseau', detail: '30 pers. · Terrasse' },
  { date: '2025-09-20', title: 'Cocktail inauguration', detail: '60 pers. · Salon principal' },
];

const Calendar = (() => {
  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
                     'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const DAYS_FR   = ['Lu','Ma','Me','Je','Ve','Sa','Di'];

  const now = new Date();
  let currentYear  = now.getFullYear();
  let currentMonth = now.getMonth();
  let selectedDate = null;

  function toDateStr(y, m, d) {
    return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  function eventsForDate(ds) {
    return EVENTS_DATA.filter(e => e.date === ds);
  }

  function eventsForMonth(y, m) {
    const prefix = `${y}-${String(m + 1).padStart(2,'0')}`;
    return EVENTS_DATA.filter(e => e.date.startsWith(prefix));
  }

  function formatDate(ds) {
    const d = new Date(ds + 'T12:00:00');
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  // ── Rendering ──

  function renderGrid() {
    const grid = document.getElementById('cal-grid');
    if (!grid) return;

    const todayStr = toDateStr(now.getFullYear(), now.getMonth(), now.getDate());
    const firstWeekday = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7; // Mon=0
    const daysInMonth  = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrev   = new Date(currentYear, currentMonth, 0).getDate();

    let html = DAYS_FR.map(d => `<div class="cal-hd">${d}</div>`).join('');

    for (let i = firstWeekday - 1; i >= 0; i--) {
      html += `<div class="cal-day other-month">${daysInPrev - i}</div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const ds = toDateStr(currentYear, currentMonth, d);
      const cls = ['cal-day',
        ds === todayStr   ? 'today'     : '',
        eventsForDate(ds).length        ? 'has-event' : '',
        ds === selectedDate             ? 'selected'  : '',
      ].filter(Boolean).join(' ');
      html += `<div class="${cls}" data-date="${ds}">${d}</div>`;
    }

    const filled = firstWeekday + daysInMonth;
    const tail   = filled % 7 === 0 ? 0 : 7 - (filled % 7);
    for (let d = 1; d <= tail; d++) {
      html += `<div class="cal-day other-month">${d}</div>`;
    }

    grid.innerHTML = html;

    grid.querySelectorAll('.cal-day[data-date]').forEach(el => {
      el.addEventListener('click', () => {
        const ds = el.getAttribute('data-date');
        selectedDate = selectedDate === ds ? null : ds;
        renderGrid();
        renderDetail();
      });
    });
  }

  function renderDetail() {
    const titleEl = document.getElementById('cal-detail-title');
    const listEl  = document.getElementById('cal-detail-list');
    if (!titleEl || !listEl) return;

    let events;
    if (selectedDate) {
      events = eventsForDate(selectedDate);
      const label = formatDate(selectedDate);
      titleEl.textContent = events.length
        ? `Événements — ${label}`
        : `Aucun événement — ${label}`;
    } else {
      events = eventsForMonth(currentYear, currentMonth);
      titleEl.textContent = events.length
        ? `${events.length} événement${events.length > 1 ? 's' : ''} ce mois`
        : 'Aucun événement ce mois';
    }

    if (!events.length) {
      listEl.innerHTML = '<div class="cal-empty">Aucun événement.</div>';
      return;
    }

    listEl.innerHTML = events.map(e => `
      <div class="activity-item">
        <div class="act-dot terra"></div>
        <div class="act-body">
          <div class="act-text"><strong>${formatDate(e.date)} — ${e.title}</strong></div>
          <div class="act-text" style="color:var(--muted);font-size:11px;">${e.detail}</div>
        </div>
      </div>`).join('');
  }

  function updateHeader() {
    const hEl = document.getElementById('agenda-heading');
    const sEl = document.getElementById('agenda-sub');
    const mSel = document.getElementById('cal-month-sel');
    const ySel = document.getElementById('cal-year-sel');

    if (hEl) hEl.textContent = `Agenda — ${MONTHS_FR[currentMonth]} ${currentYear}`;

    const count = eventsForMonth(currentYear, currentMonth).length;
    if (sEl) sEl.textContent = count
      ? `${count} événement${count > 1 ? 's' : ''} confirmé${count > 1 ? 's' : ''}`
      : 'Aucun événement';

    if (mSel) mSel.value = currentMonth;
    if (ySel) ySel.value = currentYear;
  }

  function render() {
    renderGrid();
    renderDetail();
    updateHeader();
  }

  // ── Init ──

  function init() {
    // Month select
    const mSel = document.getElementById('cal-month-sel');
    if (mSel) {
      MONTHS_FR.forEach((m, i) => {
        const o = document.createElement('option');
        o.value = i; o.textContent = m;
        mSel.appendChild(o);
      });
      mSel.addEventListener('change', () => {
        currentMonth = parseInt(mSel.value);
        selectedDate = null;
        render();
      });
    }

    // Year select
    const ySel = document.getElementById('cal-year-sel');
    if (ySel) {
      for (let y = 2023; y <= now.getFullYear() + 3; y++) {
        const o = document.createElement('option');
        o.value = y; o.textContent = y;
        ySel.appendChild(o);
      }
      ySel.addEventListener('change', () => {
        currentYear = parseInt(ySel.value);
        selectedDate = null;
        render();
      });
    }

    // Prev / Next
    document.getElementById('cal-prev')?.addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      selectedDate = null;
      render();
    });

    document.getElementById('cal-next')?.addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      selectedDate = null;
      render();
    });

    render();
  }

  return { init, EVENTS_DATA };
})();

Calendar.init();

// ── EXPORT FOR TESTING ──

window.ChezPapi = {
  API,
  Storage,
  Calendar,
  showPanel,
  toggleSidebar,
  showNotification
};

console.log('Chez Papi PWA initialized ✓');
