/* ChowHuay Pro — Settings view */
(function (global) {
  'use strict';

  let testing = false;

  const THEMES = [
    { id: 'blue', label: 'Merchant Blue', color: '#003d9b' },
    { id: 'green', label: 'Eco Green', color: '#006a3d' },
    { id: 'orange', label: 'Sunset Orange', color: '#9a3412' },
    { id: 'purple', label: 'Deep Purple', color: '#6d28d9' },
    { id: 'brown', label: 'Creamy Brown', color: '#5d4037' }
  ];

  function render(container) {
    const cfg = Store.state.settings;
    const setup = Api.getSetup();
    const configured = Api.isConfigured();
    const dark = document.documentElement.dataset.mode === 'dark';
    const theme = document.documentElement.dataset.theme || 'blue';
    const lastSync = Store.state.syncedAt;

    container.innerHTML = `
      <div style="margin-bottom:16px;"><h1 class="h2">การตั้งค่า</h1><p class="caption">เชื่อมต่อฐานข้อมูล ธีม และความปลอดภัย</p></div>

      <div class="card mb">
        <div class="card-body">
          <h3 class="h3 mb">เชื่อมต่อ Google Apps Script (ฐานข้อมูล)</h3>
          ${configured
            ? `<div class="mb-sm" style="display:flex;align-items:center;gap:8px;">${UI.badge('success', 'เชื่อมต่อแล้ว')}<span class="caption">${U.esc(Api.gasUrl())}</span></div>`
            : `<div class="mb-sm">${UI.badge('warning', 'ยังไม่ได้ตั้งค่า')}</div>`}
          <div class="field">
            <label>URL ของ Web App (/exec)</label>
            <input class="input" id="s-url" type="text" value="${U.esc(Api.gasUrl())}" placeholder="https://script.google.com/macros/s/.../exec">
          </div>
          <div class="flex gap" style="flex-wrap:wrap;">
            <button class="btn btn-primary" id="s-test">${UI.icon('bolt')} ทดสอบการเชื่อมต่อ</button>
            <button class="btn btn-outline" id="s-save-url">บันทึก URL</button>
          </div>
          <p class="caption mt">ขั้นตอน: เปิด apps script → นำ Code.gs ไปวาง → Enable Drive API → Deploy > Web app (Execute as: Me, Access: Anyone) → คัดลอก URL มาวางตรงนี้</p>
          <p class="caption mt-sm">อัปเดตล่าสุด: ${lastSync ? U.fmtDateTime(lastSync) : 'ยังไม่เคยซิงก์'}</p>
        </div>
      </div>

      <div class="card mb">
        <div class="card-body">
          <h3 class="h3 mb">ข้อมูลร้านค้า</h3>
          <div class="field"><label>ชื่อร้าน</label><input class="input" id="s-store" type="text" value="${U.esc(cfg.storeName || '')}" placeholder="ชื่อร้าน"></div>
          <button class="btn btn-secondary" id="s-save-store">${UI.icon('save')} บันทึกข้อมูลร้าน</button>
        </div>
      </div>

      <div class="card mb">
        <div class="card-body">
          <h3 class="h3 mb">การปรับแต่งหน้าตาแอป</h3>
          <div class="field"><label>ธีมสี</label>
            <div class="grid-3" style="gap:10px;">
              ${THEMES.map((t) => `
                <button class="theme-btn ${theme === t.id ? 'theme-active' : ''}" data-theme-set="${t.id}" style="cursor:pointer;border:2px solid ${theme === t.id ? 'var(--primary)' : 'var(--outline-variant)'};background:var(--surface-container-lowest);border-radius:12px;padding:10px;display:flex;flex-direction:column;align-items:center;gap:8px;">
                  <div style="width:40px;height:40px;border-radius:50%;background:${t.color};box-shadow:var(--elev-1);"></div>
                  <span class="caption" style="font-weight:600;color:var(--on-surface);">${t.label}</span>
                </button>`).join('')}
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;">
            <span class="title">โหมดมืด</span>
            <label style="position:relative;display:inline-block;cursor:pointer;">
              <input type="checkbox" id="s-dark" ${dark ? 'checked' : ''} class="hidden">
              <div style="width:48px;height:28px;background:${dark ? 'var(--primary)' : 'var(--outline-variant)'};border-radius:999px;transition:background 0.2s;position:relative;">
                <span style="position:absolute;top:3px;left:${dark ? '23px' : '3px'};width:22px;height:22px;background:#fff;border-radius:50%;transition:left 0.2s;box-shadow:var(--elev-1);"></span>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div class="card mb">
        <div class="card-body">
          <h3 class="h3 mb">ความปลอดภัย</h3>
          <div class="field"><label>รหัสผ่าน 4 หลัก (ล็อกหน้าจอ)</label>
            <input class="input" id="s-pass" type="password" inputmode="numeric" maxlength="4" value="${U.esc(Api.localPasscode())}" placeholder="1234">
          </div>
          <p class="caption mb">รหัสจะถูกบันทึกไว้ในเครื่องและบนเซิร์ฟเวอร์ (แนะนำเปลี่ยนเป็นรหัสเฉพาะของคุณ)</p>
          <button class="btn btn-outline" id="s-save-pass">${UI.icon('lock')} บันทึกรหัสผ่าน</button>
        </div>
      </div>

      <div class="card mb">
        <div class="card-body">
          <h3 class="h3 mb">ติดตั้งเป็นแอป (PWA)</h3>
          <p class="caption mb">เพิ่มไอคอนไว้หน้าจอหลัก ใช้งานเหมือนแอปจริง โหลดเร็วและรองรับออฟไลน์</p>
          <button class="btn btn-secondary" id="s-install">${UI.icon('download')} เพิ่มลงหน้าจอหลัก</button>
          <p class="caption mt-sm" id="s-install-ios"></p>
        </div>
      </div>

      <div class="card mb">
        <div class="card-body" style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <h3 class="h3">ข้อมูลเครื่อง (แคช)</h3>
            <p class="caption">ล้างข้อมูลชั่วคราวบนเครื่อง (ไม่กระทบข้อมูลใน Google Sheets)</p>
          </div>
          <button class="btn btn-outline btn-sm text-error" id="s-clear">${UI.icon('delete_sweep')} ล้างแคช</button>
        </div>
      </div>

      <p class="caption" style="text-align:center;color:var(--outline);">ChowHuay Pro v${CONFIG.APP_VERSION} · ออกแบบให้โชว์ห่วยไทย</p>
      <div style="height:16px;"></div>
    `;

    wire(container);
    updateInstallButton();
    const ios = document.getElementById('s-install-ios');
    if (ios && isIOS()) ios.innerHTML = '<b>iOS:</b> กดปุ่มแชร์ (⎋) ใน Safari แล้วเลือก "เพิ่มไปที่หน้าจอโฮม"';

    if (document.getElementById('s-dark')) {
      document.getElementById('s-dark').addEventListener('change', (e) => {
        applyTheme(document.documentElement.dataset.theme, e.target.checked ? 'dark' : 'light');
      });
    }
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function applyTheme(theme, mode) {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.mode = mode;
    localStorage.setItem(CONFIG.THEME_KEY, JSON.stringify({ theme, mode }));
    if (Store.state.settings) {
      Api.settings.set('theme', theme).catch(() => {});
      Api.settings.set('dark', mode === 'dark' ? '1' : '0').catch(() => {});
    }
  }

  function wire(container) {
    if (container.__wired) return;
    container.__wired = true;

    container.addEventListener('click', (e) => {
      const themeBtn = e.target.closest('[data-theme-set]');
      if (themeBtn) {
        const t = themeBtn.dataset.themeSet;
        applyTheme(t, document.documentElement.dataset.mode);
        render(container);
        return;
      }
      if (e.target.closest('#s-test')) testConnection(container);
      if (e.target.closest('#s-save-url')) saveUrl(container);
      if (e.target.closest('#s-save-store')) saveStore(container);
      if (e.target.closest('#s-save-pass')) savePass(container);
      if (e.target.closest('#s-install')) installPwa();
      if (e.target.closest('#s-clear')) clearCache(container);
    });
  }

  async function testConnection(container) {
    const btn = document.getElementById('s-test');
    if (testing) return;
    testing = true;
    const url = document.getElementById('s-url').value.trim();
    btn.innerHTML = UI.icon('progress_activity') + ' กำลังทดสอบ...';
    btn.disabled = true;
    try {
      const res = await Api.ping();
      // update cached url on success
      Api.saveSetup(Object.assign(Api.getSetup(), { url }));
      UI.toast('เชื่อมต่อสำเร็จ! ฐานข้อมูลพร้อมใช้งาน');
      await Store.refresh();
      App.renderView();
    } catch (err) {
      UI.toast('เชื่อมต่อไม่สำเร็จ: ' + err.message, 'error');
    }
    btn.innerHTML = UI.icon('bolt') + ' ทดสอบการเชื่อมต่อ';
    btn.disabled = false;
    testing = false;
    render(container);
  }

  function saveUrl(container) {
    const url = document.getElementById('s-url').value.trim();
    Api.saveSetup(Object.assign(Api.getSetup(), { url }));
    UI.toast('บันทึก URL แล้ว');
    render(container);
  }

  async function saveStore(container) {
    const name = document.getElementById('s-store').value.trim();
    if (!name) { UI.toast('ระบุชื่อร้านก่อน', 'error'); return; }
    try {
      await Api.settings.set('storeName', name);
      Store.state.settings.storeName = name;
      Store.persist();
      UI.toast('บันทึกข้อมูลร้านแล้ว');
      render(container);
    } catch (err) { UI.toast(err.message, 'error'); }
  }

  async function savePass(container) {
    const v = document.getElementById('s-pass').value;
    if (!/^\d{4}$/.test(v)) { UI.toast('รหัสผ่านต้องเป็นตัวเลข 4 หลัก', 'error'); return; }
    try {
      await Api.settings.set('passcode', v);
      Api.storePasscode(v);
      Store.state.settings.passcode = v;
      Store.persist();
      UI.toast('เปลี่ยนรหัสผ่านแล้ว');
    } catch (err) { UI.toast(err.message, 'error'); }
  }

  function clearCache(container) {
    UI.confirmDialog('ล้างแคชเครื่อง', 'ลบข้อมูลชั่วคราวบนเครื่อง? ข้อมูลใน Google Sheets ยังอยู่ครบ และจะโหลดใหม่เมื่อเชื่อมต่อ', () => {
      localStorage.removeItem(CONFIG.STORAGE_KEY);
      UI.toast('ล้างแคชแล้ว');
      setTimeout(() => location.reload(), 500);
    });
  }

  // ---- PWA install ----
  let deferredPrompt = null;
  function captureInstall(e) {
    e.preventDefault();
    deferredPrompt = e;
  }
  function updateInstallButton() {
    const btn = document.getElementById('s-install');
    if (btn) btn.style.display = (deferredPrompt || window.matchMedia('(display-mode: standalone)').matches || isIOS()) ? '' : 'none';
  }
  function installPwa() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((r) => { if (r.outcome === 'accepted') UI.toast('ติดตั้งแอปแล้ว!'); });
      deferredPrompt = null;
    } else if (isIOS()) {
      UI.openModal({ title: 'ติดตั้งบน iPhone/iPad', body: '<p class="body">แตะปุ่ม <b>แชร์ ⎋</b> ที่แถบ Safari แล้วเลือก <b>"เพิ่มไปที่หน้าจอโฮม"</b> เพื่อติดตั้งแอป</p>', foot: [UI.modalBtn('เข้าใจแล้ว', 'btn-primary', () => UI.closeModal())] });
    } else {
      UI.toast('แตะที่ไอคอนเพิ่ม (＋) ในแถบ URL ของเบราว์เซอร์ แล้วเลือก "ติดตั้งแอป"');
    }
  }

  global.ViewSettings = { render, applyTheme, captureInstall, installPwa, updateInstallButton };
})(window);
