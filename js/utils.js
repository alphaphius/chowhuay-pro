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

  global.U = {
    num, round2, fmtMoney, fmtInt, fmtDate, fmtTime, fmtDateTime, todayStr,
    esc, uid, debounce, loadImage, compressImage, imgUrl, sameDay,
    startOfWeek, startOfMonth, download
  };
})(window);
