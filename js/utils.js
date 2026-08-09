/* ChowHuay Pro — utils */
(function (global) {
  'use strict';

  function num(v) {
    const n = parseFloat(String(v === undefined || v === null ? 0 : v).replace(/[^\d.\-]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function round2(n) { return Math.round((num(n) + Number.EPSILON) * 100) / 100; }

  function fmtMoney(n, withSymbol) {
    const v = round2(n);
    const s = v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return withSymbol === false ? s : '฿' + s;
  }

  function fmtInt(n) { return num(n).toLocaleString('th-TH'); }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function fmtDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return fmtDate(iso) + ' ' + fmtTime(iso);
  }

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 46656).toString(36);
  }

  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(self, args), ms);
    };
  }

  function loadImage(fileOrUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      if (typeof fileOrUrl === 'string') img.src = fileOrUrl;
      else img.src = URL.createObjectURL(fileOrUrl);
    });
  }

  // บีบอัดรูปเป็น dataURL (JPEG) เพื่อ upload ไป Drive — เร็ว/เบา
  async function compressImage(file, maxDim, quality) {
    const max = maxDim || 600;
    const q = quality || 0.82;
    const img = await loadImage(file);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    let scale = 1;
    if (w > max || h > max) scale = Math.min(max / w, max / h);
    const cw = Math.round(w * scale), ch = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);
    return canvas.toDataURL('image/jpeg', q);
  }

  function imgUrl(imgId, size) {
    if (!imgId) return '';
    return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(String(imgId)) + '&sz=' + (size || CONFIG.IMG_SIZE);
  }

  function sameDay(iso, dayStart) {
    const d = new Date(iso);
    if (isNaN(d)) return false;
    const ref = dayStart || new Date();
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
  }

  function startOfWeek() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const day = (d.getDay() + 6) % 7; // Monday=0
    d.setDate(d.getDate() - day);
    return d;
  }

  function startOfMonth() {
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  }

  function download(filename, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // Print an HTML document without window.open() — mobile browsers block popups
  // and kill the new window, which crashed the PDF/print flow. Uses a hidden
  // iframe instead; falls back to a Blob tab if iframe printing is unsupported.
  function printHTML(docHtml) {
    window.__printHTML = docHtml;
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    const doc = win.document;
    doc.open();
    doc.write(docHtml);
    doc.close();
    const fire = () => {
      try {
        win.focus();
        win.print();
      } catch (e) {
        const url = URL.createObjectURL(new Blob([docHtml], { type: 'text/html;charset=utf-8' }));
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    };
    setTimeout(fire, 350);
    setTimeout(() => iframe.remove(), 60000);
  }

  // ---- browser notifications ----
  function notifySupported() {
    return typeof window.Notification !== 'undefined';
  }
  function notifyPermission() {
    if (!notifySupported()) return 'unsupported';
    return Notification.permission; // granted | denied | default
  }
  function notifyRequest() {
    if (!notifySupported()) return Promise.resolve('unsupported');
    if (Notification.permission === 'granted') return Promise.resolve('granted');
    if (Notification.permission === 'denied') return Promise.resolve('denied');
    try { return Notification.requestPermission(); } catch (e) { return Promise.resolve('denied'); }
  }
  function notifyShow(title, opts) {
    if (!notifySupported() || Notification.permission !== 'granted') return null;
    try { return new Notification(title, opts || {}); } catch (e) { return null; }
  }

  global.U = {
    num, round2, fmtMoney, fmtInt, fmtDate, fmtTime, fmtDateTime, todayStr,
    esc, uid, debounce, loadImage, compressImage, imgUrl, sameDay,
    startOfWeek, startOfMonth, download, printHTML,
    notifySupported, notifyPermission, notifyRequest, notifyShow
  };
})(window);
