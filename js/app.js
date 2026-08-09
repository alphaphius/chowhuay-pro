/* ChowHuay Pro — App boot: passcode, router, nav, sync, PWA */
(function (global) {
  'use strict';

  // Self-heal: when the deployed bundle version changes, clear stale caches and
  // reload once so installed PWAs never run an old bundle. Skipped in test mode.
  (async function selfHeal() {
    if (global.__TEST_MODE) return;
    try {
      const key = CONFIG.SETUP_KEY + ':v';
      if (String(localStorage.getItem(key)) === String(CONFIG.BOOT_VERSION)) return;
      localStorage.setItem(key, String(CONFIG.BOOT_VERSION));
      if (window.caches && window.caches.keys) {
        const keys = await window.caches.keys();
        if (keys.length) await Promise.all(keys.map((c) => window.caches.delete(c)));
      }
      if (location.reload) location.reload();
    } catch (e) { /* keep going */ }
  })();

  let unlocked = false;
  let pin = '';
  const MAX_PIN = 4;

  const App = {
    route: 'dashboard',

    init() {
      Store.loadCache();
      applySavedTheme();
      Store.state.settings = Store.state.settings || {};

      if (Api.isConfigured()) {
        // Always sync fresh data at boot — cached syncedAt may hold an old
        // passcode/settings (e.g. changed from another device).
        refreshSilent();
      }

      bindNav();
      bindPasscode();
      bindTopbar();
      bindGlobal();

      // PWA
      window.addEventListener('beforeinstallprompt', (e) => ViewSettings.captureInstall(e));
      registerSW();

      document.addEventListener('app:restock', (e) => {
        const prod = e.detail;
        location.hash = '#/inventory';
        setTimeout(() => ViewInventory.openRestock(prod), 60);
      });
    },

    unlock(pinOk) {
      unlocked = true;
      document.getElementById('passcode-overlay').classList.add('hidden');
      document.getElementById('app-shell').classList.remove('hidden');
      route();
    },

    renderView() {
      if (!unlocked) return;
      const containers = {
        dashboard: document.getElementById('view-dashboard'),
        pos: document.getElementById('view-pos'),
        inventory: document.getElementById('view-inventory'),
        reports: document.getElementById('view-reports'),
        settings: document.getElementById('view-settings')
      };
      const c = containers[this.route] || containers.dashboard;
      Object.keys(containers).forEach((k) => containers[k].classList.remove('active'));
      c.classList.add('active');
      try {
        if (this.route === 'dashboard') ViewDashboard.render(c);
        else if (this.route === 'pos') ViewPos.render(c);
        else if (this.route === 'inventory') ViewInventory.render(c);
        else if (this.route === 'reports') ViewReports.render(c);
        else if (this.route === 'settings') ViewSettings.render(c);
      } catch (err) {
        c.innerHTML = '<div class="empty-state"><span class="material-symbols-outlined">error</span><p class="body">เกิดข้อผิดพลาด: ' + U.esc(err.message || err) + '</p></div>';
      }
      if (!Api.isConfigured() && !Store.state.syncedAt && this.route !== 'settings') {
        UI.toast('ยังไม่ได้เชื่อมต่อฐานข้อมูล — ไปที่การตั้งค่าเพื่อตั้งค่า Apps Script', 'error');
      }
    },

    refresh() {
      return refreshSilent();
    },

    checkAlerts() {
      checkLowStockAlerts();
    }
  };

  function applySavedTheme() {
    let t = { theme: 'blue', mode: 'light' };
    try { t = Object.assign(t, JSON.parse(localStorage.getItem(CONFIG.THEME_KEY) || '{}')); } catch (e) {}
    const root = document.documentElement;
    root.dataset.theme = t.theme;
    root.dataset.mode = t.mode;
  }

  function refreshSilent() {
    return Api.isConfigured()
      ? Store.refresh().then(() => { ViewSettings.updateInstallButton(); checkLowStockAlerts(); }).catch((err) => { console.warn('sync fail', err); })
      : Promise.resolve();
  }

  // ---- low-stock browser notifications (once per product per day) ----
  function checkLowStockAlerts() {
    if (!U.notifySupported() || U.notifyPermission() !== 'granted') return;
    const setup = Api.getSetup();
    if (!setup.notify) return;
    const low = Store.lowStock().concat(Store.outOfStock());
    if (!low.length) return;
    const key = CONFIG.STORAGE_KEY + '_alerted';
    let alerted = {};
    try { alerted = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) {}
    const today = U.todayStr();
    const storeName = (Store.state.settings && Store.state.settings.storeName) || 'ChowHuay Pro';
    low.forEach((p) => {
      if (alerted[p.id] === today) return;
      alerted[p.id] = today;
      const out = U.num(p.stock) <= 0;
      U.notifyShow(storeName + ' — สินค้า' + (out ? 'หมด' : 'ใกล้หมด'), {
        body: p.name + ' (เหลือ ' + U.fmtInt(p.stock) + ' ' + (p.unit || 'ชิ้น') + ')',
        icon: 'icons/icon-192.png',
        tag: 'lowstock-' + p.id
      });
    });
    try { localStorage.setItem(key, JSON.stringify(alerted)); } catch (e) {}
  }

  function route() {
    const h = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    App.route = CONFIG.ROUTES.includes(h) ? h : 'dashboard';
    document.querySelectorAll('[data-route]').forEach((el) => {
      const on = el.dataset.route === App.route;
      el.classList.toggle('active', on);
    });
    App.renderView();
    window.scrollTo(0, 0);
  }

  function bindNav() {
    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-route]');
      if (nav) {
        location.hash = '#/' + nav.dataset.route;
      }
    });
    window.addEventListener('hashchange', route);
  }

  function bindTopbar() {
    const syncBtn = document.getElementById('topbar-sync');
    if (syncBtn) syncBtn.addEventListener('click', async () => {
      syncBtn.style.transform = 'rotate(360deg)';
      syncBtn.style.transition = 'transform 0.4s';
      if (Api.isConfigured()) {
        await refreshSilent();
        UI.toast('ซิงก์ข้อมูลล่าสุดแล้ว');
      } else {
        UI.toast('ยังไม่ได้ตั้งค่า Apps Script URL', 'error');
        location.hash = '#/settings';
      }
      setTimeout(() => { syncBtn.style.transform = ''; syncBtn.style.transition = ''; }, 450);
      App.renderView();
    });
  }

  // ---- passcode ----
  function bindPasscode() {
    const dots = document.querySelectorAll('.pin-dot');
    window.enterPin = function (n) {
      if (pin.length >= MAX_PIN) return;
      pin += n;
      updateDots(dots);
      if (pin.length === MAX_PIN) {
        setTimeout(() => verifyPin(dots), 120);
      }
    };
    window.deletePin = function () {
      pin = pin.slice(0, -1);
      updateDots(dots);
    };

    // quick test via enter key on hidden input (desktop convenience)
    const quick = document.getElementById('pin-quick');
    if (quick) quick.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const v = quick.value.trim();
        if (/^\d{4}$/.test(v)) {
          pin = v;
          updateDots(dots);
          verifyPin(dots);
          quick.value = '';
        }
      }
    });
  }

  function updateDots(dots) {
    dots.forEach((d, i) => {
      d.className = 'pin-dot' + (i < pin.length ? ' filled' : '');
    });
  }

  async function verifyPin(dots) {
    // Always confirm against the freshly-synced backend passcode, never a stale
    // cached one (it can hold an old PIN from another device/earlier session).
    // Falls back to cache/local only when the backend is unreachable.
    if (Api.isConfigured() && !Store.state.loaded) {
      UI.toast('กำลังตรวจสอบรหัสกับฐานข้อมูล...');
      const t0 = Date.now();
      while (!Store.state.loaded && Date.now() - t0 < 8000) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    const expected = (Store.state.settings && Store.state.settings.passcode) || Api.localPasscode();
    if (pin === String(expected)) {
      dots.forEach((d) => d.classList.add('success'));
      setTimeout(() => {
        pin = '';
        updateDots(dots);
        App.unlock(true);
      }, 250);
    } else {
      dots.forEach((d) => d.classList.add('error'));
      const wrap = document.querySelector('.pin-dots');
      if (wrap) wrap.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 350 });
      setTimeout(() => {
        pin = '';
        updateDots(dots);
        UI.toast('รหัสผ่านไม่ถูกต้อง', 'error');
      }, 450);
    }
  }

  function bindGlobal() {
    // Enter key on PIN quick input focuses
    document.addEventListener('keydown', () => {});
    // Prevent double-tap zoom on mobile
    document.addEventListener('dblclick', (e) => e.preventDefault());
  }

  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW fail', err));
    }
  }

  global.App = App;
})(window);
