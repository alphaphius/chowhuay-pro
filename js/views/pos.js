/* ChowHuay Pro — POS view */
(function (global) {
  'use strict';

  let cart = [];        // [{id, qty}]
  let filterCat = '__all';
  let filterQ = '';
  let scannerActive = false;

  const cartById = (id) => cart.find((c) => String(c.id) === String(id));
  const cartTotal = () => cart.reduce((a, c) => a + U.num(Store.productById(c.id).sell) * c.qty, 0);
  const cartCount = () => cart.reduce((a, c) => a + c.qty, 0);

  function render(container) {
    container.innerHTML = `
      <div class="pos-layout">
          <!-- LEFT -->
          <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <h1 class="h2">จุดขายสินค้า</h1>
            <span class="caption" id="pos-clock"></span>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <div class="search-bar grow">
              ${UI.icon('search')}
              <input id="pos-search" type="text" placeholder="ค้นหาสินค้า..." value="${U.esc(filterQ)}">
              <button id="pos-clear-q" class="btn-icon" data-qclear>${UI.icon('close')}</button>
            </div>
            <button id="pos-scan" class="btn btn-primary" style="width:48px;height:48px;border-radius:12px;padding:0;">${UI.icon('barcode_scanner')}</button>
          </div>
          <div class="chip-row" id="pos-cats">
            <button class="chip ${filterCat === '__all' ? 'active' : ''}" data-cat="__all">ทั้งหมด</button>
            ${Store.state.categories.map((c) => `<button class="chip ${filterCat === c ? 'active' : ''}" data-cat="${U.esc(c)}">${U.esc(c)}</button>`).join('')}
          </div>
          <div class="product-grid mt" id="pos-grid"></div>
        </div>
        <!-- RIGHT (desktop cart) -->
        <div class="pos-cart pos-cart-desktop">
          ${cartPanelHTML('desktop')}
        </div>
      </div>
      <!-- mobile cart bar -->
      <div class="mobile-cart-bar ${cart.length ? '' : 'hidden'}" id="mobile-cart-bar">
        <div>
          <div class="caption">${cartCount()} รายการ</div>
          <div class="h3 text-primary">${U.fmtMoney(cartTotal())}</div>
        </div>
        <button class="btn btn-secondary" id="btn-open-cart">${UI.icon('shopping_cart_checkout')} สรุปรายการ</button>
      </div>
    `;
    drawGrid(container);
    wirePosEvents(container);
    updateCartUI(container);
    tickClock();
  }

  function tickClock() {
    const el = document.getElementById('pos-clock');
    if (el) el.textContent = new Date().toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function filteredProducts() {
    const q = filterQ.trim().toLowerCase();
    return Store.products().filter((p) => {
      if (filterCat !== '__all' && String(p.category || '') !== filterCat) return false;
      if (q) {
        const hay = (p.name + ' ' + (p.barcode || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function drawGrid(container) {
    const grid = container.querySelector('#pos-grid');
    const list = filteredProducts();
    if (!list.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><span class="material-symbols-outlined">search_off</span><p>ไม่พบสินค้า</p></div>';
      return;
    }
    grid.innerHTML = list.map((p) => {
      const stock = U.num(p.stock);
      const out = stock <= 0;
      const low = stock > 0 && stock <= U.num(p.minStock);
      const inCart = cartById(p.id);
      const sel = inCart ? ' selected' : '';
      return `
        <div class="product-card${out ? ' product-out' : ''}${sel}" data-add="${U.esc(p.id)}" title="${U.esc(p.name)}">
          <div class="product-thumb">
            ${p.imgId ? `<img loading="lazy" src="${U.imgUrl(p.imgId)}" alt="${U.esc(p.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">` : ''}
            <div class="placeholder" ${p.imgId ? 'style="display:none;"' : ''}>${UI.icon('shopping_basket')}</div>
            ${out ? '<span class="stock-badge badge badge-warning">หมด</span>'
              : low ? '<span class="stock-badge badge badge-warning">เหลือ ' + U.fmtInt(stock) + '</span>'
              : '<span class="stock-badge badge badge-success">มี ' + U.fmtInt(stock) + '</span>'}
            ${inCart ? '<span class="stock-badge badge badge-info" style="left:auto;right:8px;bottom:8px;">' + inCart.qty + ' ในรถ</span>' : ''}
          </div>
          <div class="product-info">
            <div class="product-name line-clamp-2">${U.esc(p.name)}</div>
            <div class="product-price">${U.fmtMoney(p.sell)}</div>
          </div>
        </div>`;
    }).join('');
  }

  function addToCart(id) {
    const p = Store.productById(id);
    if (!p) return;
    const stock = U.num(p.stock);
    const cur = cartById(id);
    if (stock <= 0) { UI.toast(p.name + ' หมดสต็อก', 'error'); return; }
    if (cur && cur.qty >= stock) { UI.toast('สต็อกไม่พอสำหรับ ' + p.name, 'error'); return; }
    if (cur) cur.qty += 1;
    else cart.push({ id: String(id), qty: 1 });
    const view = document.getElementById('view-pos');
    if (view) { drawGrid(view); updateCartUI(view); }
  }

  function changeQty(id, delta) {
    const cur = cartById(id);
    const p = Store.productById(id);
    if (!cur) return;
    cur.qty += delta;
    if (cur.qty <= 0) cart = cart.filter((c) => String(c.id) !== String(id));
    if (p && cur.qty > U.num(p.stock)) { cur.qty = U.num(p.stock); UI.toast('สต็อกไม่พอ', 'error'); }
    const view = document.getElementById('view-pos');
    if (view) { drawGrid(view); updateCartUI(view); }
  }

  function cartPanelHTML(kind) {
    if (!cart.length) {
      return `
        <div class="cart-panel">
          <div class="cart-head"><h3 class="h3">สรุปรายการ</h3></div>
          <div class="cart-items" style="align-items:center;justify-content:center;">
            <div class="empty-state"><span class="material-symbols-outlined">add_shopping_cart</span><p>ยังไม่มีสินค้าในตะกร้า</p></div>
          </div>
        </div>`;
    }
    const items = cart.map((c) => {
      const p = Store.productById(c.id);
      if (!p) return '';
      return `
        <div class="cart-item">
          <button class="btn-icon" style="position:absolute;top:6px;right:6px;width:26px;height:26px;" data-cart-remove="${U.esc(c.id)}">${UI.icon('close', 'text-muted')}</button>
          <div class="thumb">${p.imgId ? `<img loading="lazy" src="${U.imgUrl(p.imgId)}" alt="">` : UI.icon('shopping_basket')}</div>
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between;">
            <div class="label truncate">${U.esc(p.name)}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <span class="price-sm text-primary">${U.fmtMoney(p.sell * c.qty)}</span>
              <div class="stepper">
                <button data-cart-minus="${U.esc(c.id)}">${UI.icon('remove')}</button>
                <span>${c.qty}</span>
                <button data-cart-plus="${U.esc(c.id)}">${UI.icon('add')}</button>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');

    const subtotal = cartTotal();
    return `
      <div class="cart-panel">
        <div class="cart-head">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <h3 class="h3">สรุปรายการ</h3>
            <button class="btn btn-ghost btn-sm" data-cart-clear>${UI.icon('delete_sweep')} ล้าง</button>
          </div>
        </div>
        <div class="cart-items">${items}</div>
        <div class="cart-foot">
          <div style="display:flex;justify-content:space-between;"><span class="caption">รวม (${cartCount()} รายการ)</span><span class="label">${U.fmtMoney(subtotal)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span class="h3">ยอดสุทธิ</span><span class="price text-primary">${U.fmtMoney(subtotal)}</span></div>
          <button class="btn btn-secondary btn-lg btn-block" data-checkout>${UI.icon('payments')} ชำระเงิน</button>
        </div>
      </div>`;
  }

  function updateCartUI(container) {
    const bar = container.querySelector('#mobile-cart-bar');
    if (bar) {
      bar.classList.toggle('hidden', !cart.length);
      bar.querySelector('.caption').textContent = cartCount() + ' รายการ';
      bar.querySelector('.h3').textContent = U.fmtMoney(cartTotal());
    }
    const dPanel = container.querySelector('.pos-cart-desktop');
    if (dPanel) {
      const scrolled = dPanel.scrollTop;
      dPanel.innerHTML = cartPanelHTML('desktop');
      if (typeof scrolled === 'number') dPanel.scrollTop = scrolled;
    }
  }

  function wirePosEvents(container) {
    container.addEventListener('input', (e) => {
      if (e.target.id === 'pos-search') {
        filterQ = e.target.value;
        drawGrid(container);
      }
    });
    container.addEventListener('click', (e) => {
      const grid = e.target.closest('[data-add]');
      if (grid) { addToCart(grid.dataset.add); return; }

      const cat = e.target.closest('[data-cat]');
      if (cat) {
        filterCat = cat.dataset.cat;
        container.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('active', b.dataset.cat === filterCat));
        drawGrid(container);
        return;
      }

      if (e.target.closest('#pos-scan')) { openScanner(handleScannedCode); return; }
      if (e.target.closest('[data-qclear]')) { filterQ = ''; const i = container.querySelector('#pos-search'); if (i) i.value = ''; drawGrid(container); return; }

      const rm = e.target.closest('[data-cart-remove]');
      if (rm) { cart = cart.filter((c) => String(c.id) !== rm.dataset.cartRemove); const v = document.getElementById('view-pos'); drawGrid(v); updateCartUI(v); return; }

      const minus = e.target.closest('[data-cart-minus]');
      if (minus) { changeQty(minus.dataset.cartMinus, -1); return; }
      const plus = e.target.closest('[data-cart-plus]');
      if (plus) { changeQty(plus.dataset.cartPlus, 1); return; }
      if (e.target.closest('[data-cart-clear]')) { cart = []; const v = document.getElementById('view-pos'); drawGrid(v); updateCartUI(v); return; }

      if (e.target.closest('#btn-open-cart')) { openCartSheet(); return; }
      if (e.target.closest('[data-checkout]')) { openCheckout(); return; }
    });
  }

  function openCartSheet() {
    const body = document.createElement('div');
    body.innerHTML = cartPanelHTML('sheet');
    body.querySelector('[data-checkout]').addEventListener('click', () => { UI.closeModal(); openCheckout(); });
    const clearBtn = body.querySelector('[data-cart-clear]');
    if (clearBtn) clearBtn.addEventListener('click', () => { cart = []; UI.closeModal(); const v = document.getElementById('view-pos'); drawGrid(v); updateCartUI(v); });
    body.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-cart-remove]');
      if (rm) { cart = cart.filter((c) => String(c.id) !== rm.dataset.cartRemove); const v = document.getElementById('view-pos'); drawGrid(v); updateCartUI(v); body.querySelector('.cart-items').innerHTML = cartPanelHTML('sheet'); return; }
      const minus = e.target.closest('[data-cart-minus]');
      if (minus) { changeQty(minus.dataset.cartMinus, -1); body.querySelector('.cart-items').innerHTML = cartPanelHTML('sheet'); return; }
      const plus = e.target.closest('[data-cart-plus]');
      if (plus) { changeQty(plus.dataset.cartPlus, 1); body.querySelector('.cart-items').innerHTML = cartPanelHTML('sheet'); return; }
    });
    UI.openModal({ title: 'ตะกร้าสินค้า', body, foot: [] });
  }

  // ---- checkout ----
  function openCheckout() {
    if (!cart.length) { UI.toast('ยังไม่มีสินค้าในตะกร้า', 'error'); return; }
    const subtotal = cartTotal();
    const body = document.createElement('div');
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:14px;"><span class="caption">รวม ${cartCount()} รายการ</span><span class="label">${U.fmtMoney(subtotal)}</span></div>
      <div class="field">
        <label>ส่วนลดท้ายบิล (บาท)</label>
        <input class="input" id="co-discount" type="number" min="0" value="0" placeholder="0.00">
      </div>
      <div class="field">
        <label>วิธีชำระเงิน</label>
        <div class="grid-3" id="co-payment" style="gap:8px;">
          <label style="cursor:pointer;">
            <input type="radio" name="co-pay" value="cash" checked class="hidden">
            <div class="card card-body" style="text-align:center;padding:14px 8px;border:2px solid var(--primary);">${UI.icon('payments')}<div class="label mt-sm">เงินสด</div></div>
          </label>
          <label style="cursor:pointer;">
            <input type="radio" name="co-pay" value="promptpay" class="hidden">
            <div class="card card-body" style="text-align:center;padding:14px 8px;">${UI.icon('qr_code_scanner')}<div class="label mt-sm">PromptPay</div></div>
          </label>
          <label style="cursor:pointer;">
            <input type="radio" name="co-pay" value="card" class="hidden">
            <div class="card card-body" style="text-align:center;padding:14px 8px;">${UI.icon('credit_card')}<div class="label mt-sm">บัตร</div></div>
          </label>
        </div>
      </div>
      <div id="co-cash-area">
        <div class="field">
          <label>รับเงินมา (บาท)</label>
          <input class="input" id="co-cash" type="number" min="0" placeholder="500.00">
        </div>
        <div style="display:flex;justify-content:space-between;" class="mb"><span class="caption">เงินทอน</span><span class="price-sm text-secondary" id="co-change">฿0.00</span></div>
      </div>
      <div class="divider"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="h3">ยอดสุทธิ</span>
        <span class="price text-primary" id="co-total">${U.fmtMoney(subtotal)}</span>
      </div>
    `;
    const confirmBtn = UI.modalBtn('ยืนยันการขาย', 'btn-secondary btn-block btn-lg', () => doCheckout(subtotal, body));
    UI.openModal({ title: 'ชำระเงิน', body, foot: [confirmBtn] });

    const totalEl = body.querySelector('#co-total');
    const changeEl = body.querySelector('#co-change');
    const cashArea = body.querySelector('#co-cash-area');
    const upd = () => {
      const disc = U.num(body.querySelector('#co-discount').value);
      const total = Math.max(0, subtotal - disc);
      totalEl.textContent = U.fmtMoney(total);
      const pay = body.querySelector('input[name="co-pay"]:checked').value;
      cashArea.style.display = pay === 'cash' ? '' : 'none';
      const cash = U.num(body.querySelector('#co-cash').value);
      changeEl.textContent = U.fmtMoney(cash >= total ? cash - total : 0);
    };
    body.querySelector('#co-discount').addEventListener('input', upd);
    body.querySelector('#co-cash').addEventListener('input', upd);
    body.querySelectorAll('input[name="co-pay"]').forEach((r) => r.addEventListener('change', upd));
  }

  function doCheckout(subtotal, body) {
    const discount = Math.min(U.num(body.querySelector('#co-discount').value), subtotal);
    const total = Math.max(0, subtotal - discount);
    const payment = body.querySelector('input[name="co-pay"]:checked').value;
    const cashReceived = payment === 'cash' ? U.num(body.querySelector('#co-cash').value) : total;
    const sale = {
      items: cart.map((c) => { const p = Store.productById(c.id); return { id: c.id, qty: c.qty, sell: p.sell }; }),
      discount,
      payment,
      cashReceived
    };
    const btn = body.closest('.modal-sheet').querySelector('.modal-foot .btn');
    btn.disabled = true;
    btn.innerHTML = UI.icon('progress_activity') + ' กำลังบันทึก...';
    Api.sale.create(sale).then((res) => {
      UI.closeModal();
      UI.toast('บันทึกยอดขาย ' + res.sale.code + ' แล้ว');
      cart = [];
      return Store.refresh();
    }).then(() => {
      const view = document.getElementById('view-pos');
      if (view) { drawGrid(view); updateCartUI(view); }
      App.renderView(true);
      if (window.App && App.checkAlerts) App.checkAlerts();
      showReceipt(sale, total, discount, payment);
    }).catch((err) => {
      btn.disabled = false;
      btn.textContent = 'ยืนยันการขาย';
      UI.toast(err.message || 'บันทึกไม่สำเร็จ', 'error');
      Store.refresh().then(() => { const v = document.getElementById('view-pos'); if (v) { drawGrid(v); updateCartUI(v); } });
    });
  }

  function showReceipt(sale, total, discount, payment) {
    const cfg = Store.state.settings;
    const storeName = cfg.storeName || 'ร้านโชว์ห่วยของฉัน';
    const body = `
      <div style="text-align:center;margin-bottom:16px;">
        <div class="h3">${U.esc(storeName)}</div>
        <div class="caption">${new Date().toLocaleString('th-TH')}</div>
      </div>
      <div class="list mb">
        ${sale.items.map((it) => {
          const p = Store.productById(it.id) || { name: '?', sell: it.sell };
          return `<div class="list-row"><div style="flex:1"><div class="label">${U.esc(p.name)}</div><div class="caption">${it.qty} × ${U.fmtMoney(p.sell)}</div></div><div class="label">${U.fmtMoney(it.qty * p.sell)}</div></div>`;
        }).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;"><span class="caption">รวม</span><span class="label">${U.fmtMoney(total + discount)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;"><span class="caption">ส่วนลด</span><span class="label">-${U.fmtMoney(discount)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;"><span class="h3">ยอดสุทธิ</span><span class="price text-primary">${U.fmtMoney(total)}</span></div>
      <div class="caption mt">ชำระด้วย ${payment === 'cash' ? 'เงินสด' : payment === 'promptpay' ? 'PromptPay' : 'บัตรเครดิต'}</div>
    `;
    const printBtn = UI.modalBtn('พิมพ์ / PDF', 'btn-secondary', () => { UI.closeModal(); printReceipt(storeName, sale, total, discount, payment); });
    const okBtn = UI.modalBtn('เรียบร้อย', 'btn-primary', () => UI.closeModal());
    UI.openModal({ title: 'ชำระเงินสำเร็จ', body, foot: [printBtn, okBtn] });
  }

  function printReceipt(storeName, sale, total, discount, payment) {
    const rows = sale.items.map((it) => {
      const p = Store.productById(it.id) || { name: '?', sell: it.sell };
      return `<tr><td>${U.esc(p.name)}</td><td style="text-align:center;">${it.qty}</td><td style="text-align:right;">${U.fmtMoney(p.sell)}</td><td style="text-align:right;">${U.fmtMoney(it.qty * p.sell)}</td></tr>`;
    }).join('');
    const html = `
      <div class="print-area">
        <h2 style="text-align:center;margin-bottom:4px;">${U.esc(storeName)}</h2>
        <p style="text-align:center;font-size:12px;color:#555;">${new Date().toLocaleString('th-TH')}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:14px;">
          <tr style="border-bottom:1px solid #999;"><th style="text-align:left;">สินค้า</th><th>จำนวน</th><th>ราคา</th><th>รวม</th></tr>
          ${rows}
        </table>
        <hr style="margin:12px 0;">
        <p style="font-size:15px;">รวม <b>${U.fmtMoney(total + discount)}</b></p>
        <p style="font-size:15px;">ส่วนลด <b>-${U.fmtMoney(discount)}</b></p>
        <p style="font-size:18px;">ยอดสุทธิ <b>${U.fmtMoney(total)}</b></p>
        <p style="font-size:13px;color:#555;">ชำระด้วย ${payment === 'cash' ? 'เงินสด' : payment === 'promptpay' ? 'PromptPay' : 'บัตรเครดิต'}</p>
      </div>`;
    const w = window.open('', '_blank', 'width=380,height=640');
    w.document.write('<html><head><meta charset="utf-8"><title>ใบเสร็จ</title></head><body>' + html + '</body></html>');
    w.document.close();
    w.focus();
    w.print();
  }

  // ---- barcode scanner ----
  let scanCleanup = null;
  function openScanner(onCode) {
    if (scannerActive) return;
    const root = document.createElement('div');
    root.className = 'modal-backdrop';
    root.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-head"><h3 class="h3">สแกนบาร์โค้ด</h3><button class="btn-icon" data-scan-close>${UI.icon('close')}</button></div>
        <div class="modal-body">
          <div id="scan-view" style="width:100%;border-radius:12px;overflow:hidden;background:#000;min-height:220px;display:flex;align-items:center;justify-content:center;color:#fff;"></div>
          <p class="caption mt mb">หรือพิมพ์บาร์โค้ดด้วยตัวเอง</p>
          <div class="input-group">
            <input class="input grow" id="scan-manual" type="text" placeholder="พิมพ์/วางบาร์โค้ด">
            <button class="btn btn-primary" id="scan-submit">ค้นหา</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(root);
    document.body.style.overflow = 'hidden';
    scannerActive = true;

    const view = root.querySelector('#scan-view');
    const manual = root.querySelector('#scan-manual');

    const stop = () => {
      scannerActive = false;
      if (scanCleanup) { scanCleanup(); scanCleanup = null; }
      root.remove();
      document.body.style.overflow = '';
    };
    root.querySelector('[data-scan-close]').addEventListener('click', stop);
    root.addEventListener('click', (e) => { if (e.target === root) stop(); });
    manual.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitManual(); });
    root.querySelector('#scan-submit').addEventListener('click', submitManual);

    function submitManual() {
      const code = manual.value.trim();
      if (!code) return;
      stop();
      onCode(code);
    }

    function found(text) {
      stop();
      onCode(text);
    }

    // native BarcodeDetector (fast) on Chrome/Android
    if ('BarcodeDetector' in window) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          const video = document.createElement('video');
          video.setAttribute('playsinline', '');
          video.style.width = '100%';
          video.style.height = '240px';
          video.style.objectFit = 'cover';
          view.innerHTML = '';
          view.appendChild(video);
          video.srcObject = stream;
          video.play();
          const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code', 'codabar'] });
          let running = true;
          scanCleanup = () => { running = false; stream.getTracks().forEach((t) => t.stop()); };
          (function loop() {
            if (!running) return;
            detector.detect(video).then((codes) => {
              if (codes.length) { found(codes[0].rawValue); return; }
              requestAnimationFrame(loop);
            }).catch(() => requestAnimationFrame(loop));
          })();
        })
        .catch((err) => {
          view.innerHTML = '<div style="padding:20px;text-align:center;font-size:14px;">เปิดกล้องไม่สำเร็จ<br><span style="color:#ffb4ab;">' + U.esc(err.message || '') + '</span></div>';
          if (view.nextElementSibling) view.nextElementSibling.style.display = '';
        });
    } else {
      // fallback: html5-qrcode
      loadScript('vendor/html5-qrcode.min.js', () => {
        try {
          const qr = new Html5Qrcode('scan-view');
          scanCleanup = () => { try { qr.stop().then(() => qr.clear()); } catch (e) {} };
          qr.start({ facingMode: 'environment' }, { fps: 8, qrbox: { width: 220, height: 150 } }, (text) => found(text), () => {}).catch((err) => {
            view.innerHTML = '<div style="padding:20px;text-align:center;font-size:14px;">เปิดกล้องไม่สำเร็จ</div>';
            if (view.nextElementSibling) view.nextElementSibling.style.display = '';
          });
        } catch (e) {
          view.innerHTML = '<div style="padding:20px;text-align:center;font-size:14px;">ไม่รองรับการสแกน</div>';
        }
      });
    }
  }

  function loadScript(src, cb) {
    if (document.querySelector('script[src="' + src + '"]')) return cb();
    const s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    s.onerror = cb;
    document.head.appendChild(s);
  }

  function handleScannedCode(code) {
    const p = Store.byBarcode(code);
    if (!p) { UI.toast('ไม่พบสินค้าบาร์โค้ด ' + code, 'error'); return; }
    addToCart(p.id);
    UI.toast('เพิ่ม ' + p.name + ' ในตะกร้า');
  }

  global.ViewPos = { render, openScanner, handleScannedCode, resetCart: () => { cart = []; } };
})(window);
