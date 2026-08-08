/* ChowHuay Pro — Google Apps Script API client */
(function (global) {
  'use strict';

  class ApiError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }

  function getSetup() {
    try { return JSON.parse(localStorage.getItem(CONFIG.SETUP_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveSetup(s) {
    localStorage.setItem(CONFIG.SETUP_KEY, JSON.stringify(s));
  }
  function gasUrl() {
    const s = getSetup();
    return (s.url || CONFIG.GAS_URL || '').trim().replace(/\/+$/, '');
  }
  function isConfigured() { return !!gasUrl(); }

  function storePasscode(pin) { saveSetup(Object.assign(getSetup(), { passcode: String(pin) })); }
  function localPasscode() { const s = getSetup(); return s.passcode || '1234'; }

  async function call(action, body) {
    const url = gasUrl();
    if (!url) throw new ApiError('NO_SETUP', 'ยังไม่ได้ตั้งค่า Apps Script URL');
    const sep = url.indexOf('?') >= 0 ? '&' : '?';
    let res;
    try {
      res = await fetch(url + sep + 'action=' + encodeURIComponent(action), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body || {})
      });
    } catch (e) {
      throw new ApiError('NETWORK', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ (' + e.message + ')');
    }
    let data;
    try {
      data = await res.json();
    } catch (e) {
      const txt = await res.text().catch(() => '');
      throw new ApiError('BAD_RESPONSE', 'ตอบกลับผิดรูปแบบ: ' + txt.slice(0, 200));
    }
    if (!data || data.ok !== true) {
      throw new ApiError('API', (data && data.error) || 'ข้อผิดพลาดจากเซิร์ฟเวอร์');
    }
    return data;
  }

  async function ping() { return call('ping', {}); }

  async function loadAll() { return call('getAll', {}); }

  const Api = {
    call, ping, loadAll,
    gasUrl, isConfigured, getSetup, saveSetup, storePasscode, localPasscode,
    product: {
      create: (p) => call('product:create', { product: p }),
      update: (p) => call('product:update', { product: p }),
      remove: (id) => call('product:delete', { id }),
      adjust: (id, delta) => call('product:adjust', { id, delta })
    },
    sale: {
      create: (s) => call('sale:create', { sale: s }),
      remove: (id) => call('sale:delete', { id })
    },
    purchase: {
      create: (p) => call('purchase:create', { purchase: p }),
      update: (p) => call('purchase:update', { purchase: p }),
      remove: (id) => call('purchase:delete', { id })
    },
    category: {
      create: (name) => call('category:create', { name }),
      remove: (name) => call('category:delete', { name })
    },
    settings: {
      get: () => call('settings:get', {}),
      set: (key, value) => call('settings:set', { key, value })
    },
    image: {
      upload: (b64, filename) => call('image:upload', { b64, filename }),
      remove: (id) => call('image:delete', { id })
    }
  };

  global.ApiError = ApiError;
  global.Api = Api;
})(window);
