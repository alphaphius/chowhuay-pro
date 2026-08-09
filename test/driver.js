// Local e2e driver. Injected into a copy of index.html served from localhost.
// Drives the real UI through the live Apps Script backend, then leaves a
// __DONE title marker for test/run.mjs to read.
//
// USAGE: this file is embedded by test/gen.mjs into test/index.test.html.
// Set window.__SCENARIO to 'smoke' (read-only) or 'full' (data-changing).

(function () {
  const SCENARIO = window.__SCENARIO || 'full';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (window.__log = []);
  const ok = (n) => log.push('OK ' + n);
  const bad = (n, x) => log.push('FAIL ' + n + ' ' + (x || ''));
  const errs = (window.__errs = []);
  window.addEventListener('error', (e) => errs.push('err:' + e.message));
  window.addEventListener('unhandledrejection', (e) => errs.push('rej:' + String((e.reason && e.reason.message) || e.reason)));

  async function until(fn, ms, step) {
    const t = Date.now();
    while (Date.now() - t < ms) {
      if (fn()) return true;
      await wait(step || 400);
    }
    return false;
  }

  async function boot() {
    for (let i = 0; i < 100 && !(window.Store && window.Store.state && window.App && typeof window.enterPin === 'function'); i++) await wait(100);
    await until(() => window.Store.state.loaded === true, 25000);
    if (!window.Store.state.products.length) {
      await window.Api.product.create({
        barcode: 8851888041847,
        name: 'ปลากระป๋องปู',
        category: 'ของแห้ง',
        unit: 'กระป๋อง',
        cost: 18,
        sell: 25,
        stock: 3,
        minStock: 10
      });
      await window.Store.refresh();
    }
  }

  async function unlock() {
    const expected = String(window.Store.state.settings.passcode || window.Api.localPasscode() || '1234');
    expected.split('').forEach((d) => window.enterPin(Number(d)));
    await until(() => !document.getElementById('passcode-overlay').classList.contains('hidden'), 10000);
  }

  async function smoke() {
    await boot();
    await unlock();
    await until(() => window.Store.state.products.length, 25000);
    ok('boot+data products=' + window.Store.state.products.length);

    for (const hash of ['#/dashboard', '#/pos', '#/inventory', '#/reports', '#/settings']) {
      location.hash = hash;
      await wait(800);
      const v = document.querySelector('.view.active');
      ok('view ' + hash + ': ' + (v ? v.id : 'none'));
    }
    location.hash = '#/dashboard';
    await wait(800);
    await until(() => document.querySelector('#view-dashboard canvas'), 10000);
    ok('chart canvas: ' + !!document.querySelector('#view-dashboard canvas'));

    if (errs.length) bad('JS ERRORS: ' + errs.join(' | '));
    else ok('no JS errors');
  }

  async function full() {
    await boot();
    await unlock();
    await until(() => window.Store.state.products.length, 25000);
    ok('boot+data products=' + window.Store.state.products.length);

    location.hash = '#/settings';
    await wait(900);
    const root = document.documentElement;
    document.querySelector('[data-theme-set="green"]').click();
    await wait(400);
    ok('theme green: ' + (root.dataset.theme === 'green'));
    const dark = document.getElementById('s-dark');
    if (dark) {
      dark.click();
      await wait(400);
      ok('dark mode: ' + (root.dataset.mode === 'dark'));
      dark.click();
      await wait(300);
    } else bad('dark toggle missing');

    const store = document.getElementById('s-store');
    if (store) {
      store.value = 'ร้านทดสอบ';
      store.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('s-save-store').click();
      await until(() => window.Store.state.settings.storeName === 'ร้านทดสอบ', 20000);
      ok('store name saved: ' + (window.Store.state.settings.storeName === 'ร้านทดสอบ'));
    } else bad('store input missing');

    const pass = document.getElementById('s-pass');
    if (pass) {
      pass.value = '9999';
      pass.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('s-save-pass').click();
      await until(() => window.Api.localPasscode() === '9999', 20000);
      ok('passcode saved: ' + (window.Api.localPasscode() === '9999'));
    } else bad('pass input missing');

    const notify = document.getElementById('s-notify');
    if (notify) {
      notify.click();
      await wait(900);
      ok('notify toggle saved: ' + (window.Api.getSetup().notify === true));
    } else bad('notify toggle missing');

    location.hash = '#/pos';
    await wait(900);
    document.getElementById('pos-scan').click();
    await wait(900);
    ok('scan modal opened: ' + !!document.querySelector('.modal-sheet'));
    const mclose = document.querySelector('.modal-sheet [data-mclose]');
    if (mclose) mclose.click();
    await wait(300);

    const card = document.querySelector('#view-pos [data-add]');
    card.click();
    await wait(400);
    document.querySelector('#view-pos [data-checkout]').click();
    await wait(400);
    const cash = document.querySelector('#co-cash');
    if (cash) {
      cash.value = '50';
      cash.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(200);
    }
    document.querySelector('.modal-sheet .modal-foot .btn').click();
    await until(() => window.Store.state.sales.length, 30000);
    ok('sale via UI: ' + window.Store.state.sales.length + ' code=' + (window.Store.state.sales[0] || {}).code);
    const btns = document.querySelectorAll('.modal-sheet .modal-foot .btn');
    if (btns.length) btns[btns.length - 1].click();
    await wait(300);

    location.hash = '#/dashboard';
    await wait(900);
    const rb = document.querySelector('[data-act="restock"]');
    if (rb) {
      rb.click();
      await wait(500);
      ok('restock modal: ' + !!document.querySelector('#r-qty'));
      const rq = document.querySelector('#r-qty');
      if (rq) {
        rq.value = '30';
        rq.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const rbtn = document.querySelector('.modal-sheet .modal-foot .btn');
      if (rbtn) rbtn.click();
      await until(
        () => window.Store.state.products.find((p) => String(p.barcode) === '8851888041847' && Number(p.stock) >= 30),
        30000
      );
      const stk = window.Store.state.products.find((p) => String(p.barcode) === '8851888041847');
      ok('restock applied stock=' + (stk ? stk.stock : 'n/a'));
    } else bad('restock button missing (low stock?)');

    location.hash = '#/inventory';
    await wait(900);
    document.getElementById('inv-add').click();
    await wait(400);
    ok('add product modal: ' + !!document.querySelector('#f-name'));
    const m2 = document.querySelector('.modal-sheet [data-mclose]');
    if (m2) m2.click();
    await wait(300);
    const bulk = document.querySelector('[data-mode="bulk"]');
    if (bulk) {
      bulk.click();
      await wait(500);
      ok('bulk tab: ' + !!document.querySelector('#bulk-form'));
    } else bad('bulk tab missing');
    const be = document.querySelector('[data-bedit]');
    if (be) {
      be.click();
      await wait(400);
      ok('edit purchase modal: ' + !!document.querySelector('#e-total'));
      const m3 = document.querySelector('.modal-sheet [data-mclose]');
      if (m3) m3.click();
      await wait(300);
    } else {
      // data-gated: need a purchase row for the edit button to exist
      await window.Api.purchase.create({ date: new Date().toISOString(), description: 'ทุนรวมทดสอบ', total: 120 });
      await window.Store.refresh();
      document.querySelector('[data-mode="bulk"]').click();
      await wait(600);
      const be2 = document.querySelector('[data-bedit]');
      if (be2) {
        be2.click();
        await wait(400);
        ok('edit purchase modal (after seed): ' + !!document.querySelector('#e-total'));
        const m4 = document.querySelector('.modal-sheet [data-mclose]');
        if (m4) m4.click();
        await wait(300);
      } else bad('edit purchase button still missing after seed');
    }

    location.hash = '#/reports';
    await wait(900);
    document.getElementById('r-excel').click();
    await until(() => window.XLSX, 10000);
    await wait(1000);
    ok('excel export: XLSX loaded=' + !!window.XLSX + ' rows=' + document.querySelectorAll('#view-reports table tr').length);

    if (errs.length) bad('JS ERRORS: ' + errs.join(' | '));
    else ok('no JS errors');
  }

  async function run() {
    try {
      if (SCENARIO === 'smoke') await smoke();
      else await full();
    } catch (e) {
      bad('FATAL ' + e.message);
    }
    document.title = '__DONE ' + log.length + ' | ' + log.join(' ; ');
  }
  run();
})();
