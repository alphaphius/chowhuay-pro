/**
 * ChowHuay Pro — Google Apps Script Backend
 * =========================================
 * Google Sheets = database, Google Drive = image storage.
 *
 * HOW TO DEPLOY:
 * 1) Open https://script.google.com/  -> New project -> paste this file.
 * 2) In the editor left panel, "+" -> "Drive API" -> enable (advanced service).
 * 3) Deploy -> New deployment -> type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4) Copy the /exec URL, paste into the app's Settings screen.
 *
 * Frontend talks to this via fetch POST with Content-Type: text/plain
 * (avoids CORS preflight). JSON payload in the body, action in ?action=
 */

var SCRIPT_VER = '1.0.0';

var SHEET_PRODUCTS = 'Products';
var SHEET_SALES = 'Sales';
var SHEET_PURCHASES = 'Purchases';
var SHEET_SETTINGS = 'Settings';
var SHEET_CATEGORIES = 'Categories';
var FOLDER_NAME = 'ChowHuay Pro Images';

var PRODUCT_HEADERS = ['id', 'barcode', 'name', 'category', 'unit', 'cost', 'sell', 'stock', 'minStock', 'imgId', 'created', 'updated'];
var SALE_HEADERS = ['id', 'code', 'date', 'items', 'subtotal', 'discount', 'total', 'profit', 'payment', 'cashReceived', 'change'];
var PURCHASE_HEADERS = ['id', 'date', 'description', 'total'];
var SETTING_HEADERS = ['key', 'value'];
var CATEGORY_HEADERS = ['name'];

/* ------------------------------------------------------------------ *
 *  Entry points
 * ------------------------------------------------------------------ */

function doGet(e) {
  var p = (e && e.parameter) || {};
  return route(p.action, p, {});
}

function doPost(e) {
  var p = (e && e.parameter) || {};
  var body = {};
  try {
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
  } catch (err) {
    body = {};
  }
  return route(p.action, p, body);
}

function route(action, params, body) {
  try {
    var result = handle(action, params, body);
    return jsonOk(result);
  } catch (err) {
    Logger.log('route error: %s %s', action, err.stack || err);
    return jsonErr(String(err.message || err));
  }
}

function handle(action, params, body) {
  switch (action) {
    case 'ping': return { ok: true, ver: SCRIPT_VER, time: new Date().toISOString(), sheets: getSS().getSheets().map(function (s) { return s.getName(); }) };
    case 'init': return initSheets();
    case 'getAll': return getAll();
    case 'product:create': return createProduct(body.product || {});
    case 'product:update': return updateProduct(body.product || {});
    case 'product:delete': return deleteProduct((body.product && body.product.id) || body.id);
    case 'product:adjust': return adjustStock(body.id, body.delta);
    case 'sale:create': return createSale(body.sale || {});
    case 'sale:delete': return deleteSale(body.id);
    case 'purchase:create': return createPurchase(body.purchase || {});
    case 'purchase:update': return updatePurchase(body.purchase || {});
    case 'purchase:delete': return deletePurchase(body.id);
    case 'category:create': return createCategory(body.name);
    case 'category:delete': return deleteCategory(body.name);
    case 'settings:get': return { settings: getSettings() };
    case 'settings:set': return setSetting(body.key, body.value);
    case 'image:upload': return uploadImage(body.b64, body.filename);
    case 'image:delete': return deleteImage(body.id);
    default:
      return { ok: true, msg: 'unknown action', action: action };
  }
}

/* ------------------------------------------------------------------ *
 *  Sheets bootstrap
 * ------------------------------------------------------------------ */

function getSS() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet(name, headers) {
  var ss = getSS();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (headers) {
      sh.appendRow(headers);
      sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  }
  return sh;
}

function initSheets() {
  sheet(SHEET_PRODUCTS, PRODUCT_HEADERS);
  sheet(SHEET_SALES, SALE_HEADERS);
  sheet(SHEET_PURCHASES, PURCHASE_HEADERS);
  sheet(SHEET_SETTINGS, SETTING_HEADERS);
  sheet(SHEET_CATEGORIES, CATEGORY_HEADERS);
  var cfg = getSettings();
  if (!cfg.storeName) setSetting('storeName', 'ร้านโชว์ห่วยของฉัน');
  if (!cfg.passcode) setSetting('passcode', '1234');
  if (!cfg.theme) setSetting('theme', 'blue');
  ensureImageFolder();
  return { ok: true, msg: 'sheets ready' };
}

/* ------------------------------------------------------------------ *
 *  Generic table helpers (Products / Sales / Purchases)
 * ------------------------------------------------------------------ */

function tableToObjects(sh) {
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = values[r][c];
    out.push(obj);
  }
  return out;
}

function findRowById(sh, id) {
  if (!id) return -1;
  var values = sh.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]) === String(id)) return r + 1;
  }
  return -1;
}

function uid(prefix) {
  return (prefix || 'id') + '_' + new Date().getTime().toString(36) + '_' + Math.floor(Math.random() * 46656).toString(36);
}

function nowIso() {
  return new Date().toISOString();
}

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

/* ------------------------------------------------------------------ *
 *  getAll — full snapshot for the frontend cache
 * ------------------------------------------------------------------ */

function getAll() {
  var categories = tableToObjects(sheet(SHEET_CATEGORIES, CATEGORY_HEADERS)).map(function (r) { return r.name; });
  var settings = getSettings();
  ensureImageFolder();
  return {
    ok: true,
    products: tableToObjects(sheet(SHEET_PRODUCTS, PRODUCT_HEADERS)),
    sales: tableToObjects(sheet(SHEET_SALES, SALE_HEADERS)),
    purchases: tableToObjects(sheet(SHEET_PURCHASES, PURCHASE_HEADERS)),
    categories: categories,
    settings: settings,
    syncedAt: nowIso(),
    ver: SCRIPT_VER
  };
}

/* ------------------------------------------------------------------ *
 *  Products CRUD
 * ------------------------------------------------------------------ */

function buildProductRow(p) {
  return [
    p.id, p.barcode, p.name, p.category, p.unit,
    num(p.cost), num(p.sell), num(p.stock), num(p.minStock),
    p.imgId || '', p.created || nowIso(), p.updated || nowIso()
  ];
}

function createProduct(p) {
  if (isBlank(p.name)) throw new Error('ต้องระบุชื่อสินค้า');
  var sh = sheet(SHEET_PRODUCTS, PRODUCT_HEADERS);
  var id = p.id || uid('p');
  p.id = id;
  p.created = p.created || nowIso();
  p.updated = nowIso();
  sh.appendRow(buildProductRow(p));
  return { ok: true, product: p };
}

function updateProduct(p) {
  var sh = sheet(SHEET_PRODUCTS, PRODUCT_HEADERS);
  var row = findRowById(sh, p.id);
  if (row < 0) throw new Error('ไม่พบสินค้า #' + p.id);
  var existing = tableToObjects(sh).find(function (o) { return String(o.id) === String(p.id); });
  var merged = {};
  PRODUCT_HEADERS.forEach(function (h) { merged[h] = (p[h] !== undefined) ? p[h] : (existing ? existing[h] : ''); });
  merged.id = existing.id;
  merged.updated = nowIso();
  sh.getRange(row, 1, 1, PRODUCT_HEADERS.length).setValues([buildProductRow(merged)]);
  return { ok: true, product: merged };
}

function deleteProduct(id) {
  var sh = sheet(SHEET_PRODUCTS, PRODUCT_HEADERS);
  var row = findRowById(sh, id);
  if (row < 0) throw new Error('ไม่พบสินค้า');
  var imgId = sh.getRange(row, 10).getValue();
  sh.deleteRow(row);
  if (imgId) {
    try { deleteImage(String(imgId)); } catch (e) { /* keep going */ }
  }
  return { ok: true, id: id };
}

function adjustStock(id, delta) {
  var sh = sheet(SHEET_PRODUCTS, PRODUCT_HEADERS);
  var row = findRowById(sh, id);
  if (row < 0) throw new Error('ไม่พบสินค้า');
  var current = num(sh.getRange(row, 8).getValue());
  var next = current + num(delta);
  if (next < 0) throw new Error('สต็อกไม่พอ (' + current + ' ชิ้น)');
  sh.getRange(row, 8).setValue(next);
  sh.getRange(row, 12).setValue(nowIso());
  return { ok: true, stock: next };
}

/* ------------------------------------------------------------------ *
 *  Sales
 * ------------------------------------------------------------------ */

function createSale(sale) {
  if (!sale.items || !sale.items.length) throw new Error('ไม่มีสินค้าในรายการ');

  var pSheet = sheet(SHEET_PRODUCTS, PRODUCT_HEADERS);
  var products = tableToObjects(pSheet);
  var pRow = {}; // id -> row number
  products.forEach(function (o) { pRow[String(o.id)] = o; });

  // Validate + build items with authoritative prices
  var totalCost = 0, subtotal = 0;
  var items = sale.items.map(function (it) {
    var prod = pRow[String(it.id)];
    if (!prod) throw new Error('ไม่พบสินค้าบางรายการ');
    var qty = num(it.qty);
    if (qty <= 0) throw new Error('จำนวนไม่ถูกต้อง');
    var stock = num(prod.stock);
    if (qty > stock) throw new Error('สต็อกไม่พอ: ' + prod.name + ' (เหลือ ' + stock + ')');
    var line = {
      id: prod.id, name: prod.name, unit: prod.unit || '',
      qty: qty, cost: num(prod.cost), sell: num(it.sell || prod.sell || 0)
    };
    subtotal += line.sell * qty;
    totalCost += line.cost * qty;
    return line;
  });

  var discount = num(sale.discount);
  if (discount > subtotal) discount = subtotal;
  var total = Math.max(0, subtotal - discount);
  var profit = total - totalCost;
  var payment = sale.payment || 'cash';
  var cashReceived = num(sale.cashReceived);
  var change = payment === 'cash' && cashReceived > total ? cashReceived - total : 0;

  // Decrement stock
  items.forEach(function (it) {
    var row = findRowById(pSheet, it.id);
    var stock = num(pSheet.getRange(row, 8).getValue());
    pSheet.getRange(row, 8).setValue(stock - it.qty);
    pSheet.getRange(row, 12).setValue(nowIso());
  });
  SpreadsheetApp.flush();

  // Append sale row
  var sSheet = sheet(SHEET_SALES, SALE_HEADERS);
  var code = nextSaleCode(sSheet);
  var saleRow = [
    uid('s'), code, nowIso(), JSON.stringify(items),
    round2(subtotal), round2(discount), round2(total), round2(profit),
    payment, cashReceived ? round2(cashReceived) : '', round2(change)
  ];
  sSheet.appendRow(saleRow);

  return { ok: true, sale: { id: saleRow[0], code: code, date: saleRow[2], items: items, subtotal: round2(subtotal), discount: round2(discount), total: round2(total), profit: round2(profit), payment: payment, cashReceived: cashReceived, change: round2(change) } };
}

function nextSaleCode(sh) {
  var d = new Date();
  var ymd = Utilities.formatDate(d, 'GMT+7', 'yyyyMMdd');
  var prefix = 'CH-' + ymd + '-';
  var last = 0;
  var values = sh.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    var code = String(values[r][1] || '');
    if (code.indexOf(prefix) === 0) {
      var n = parseInt(code.substring(prefix.length), 10) || 0;
      if (n > last) last = n;
    }
  }
  return prefix + String(last + 1).padStart(3, '0');
}

function deleteSale(id) {
  var sh = sheet(SHEET_SALES, SALE_HEADERS);
  var row = findRowById(sh, id);
  if (row < 0) throw new Error('ไม่พบรายการขาย');
  var items = [];
  try { items = JSON.parse(sh.getRange(row, 4).getValue() || '[]'); } catch (e) {}
  // restore stock
  if (items.length) {
    var pSheet = sheet(SHEET_PRODUCTS, PRODUCT_HEADERS);
    items.forEach(function (it) {
      var prow = findRowById(pSheet, it.id);
      if (prow > 0) {
        var stock = num(pSheet.getRange(prow, 8).getValue());
        pSheet.getRange(prow, 8).setValue(stock + num(it.qty));
        pSheet.getRange(prow, 12).setValue(nowIso());
      }
    });
    SpreadsheetApp.flush();
  }
  sh.deleteRow(row);
  return { ok: true, id: id };
}

/* ------------------------------------------------------------------ *
 *  Purchases (bulk cost / ต้นทุนเหมาจ่าย)
 * ------------------------------------------------------------------ */

function buildPurchaseRow(p) {
  return [p.id, p.date || nowIso(), p.description || '', num(p.total)];
}

function createPurchase(p) {
  var sh = sheet(SHEET_PURCHASES, PURCHASE_HEADERS);
  p.id = p.id || uid('b');
  p.date = p.date || nowIso();
  sh.appendRow(buildPurchaseRow(p));
  return { ok: true, purchase: p };
}

function updatePurchase(p) {
  var sh = sheet(SHEET_PURCHASES, PURCHASE_HEADERS);
  var row = findRowById(sh, p.id);
  if (row < 0) throw new Error('ไม่พบรายการซื้อ');
  var existing = tableToObjects(sh).find(function (o) { return String(o.id) === String(p.id); });
  var merged = {};
  PURCHASE_HEADERS.forEach(function (h) { merged[h] = (p[h] !== undefined) ? p[h] : existing[h]; });
  merged.id = existing.id;
  sh.getRange(row, 1, 1, PURCHASE_HEADERS.length).setValues([buildPurchaseRow(merged)]);
  return { ok: true, purchase: merged };
}

function deletePurchase(id) {
  var sh = sheet(SHEET_PURCHASES, PURCHASE_HEADERS);
  var row = findRowById(sh, id);
  if (row < 0) throw new Error('ไม่พบรายการซื้อ');
  sh.deleteRow(row);
  return { ok: true, id: id };
}

/* ------------------------------------------------------------------ *
 *  Categories
 * ------------------------------------------------------------------ */

function createCategory(name) {
  if (isBlank(name)) throw new Error('ต้องระบุชื่อหมวดหมู่');
  name = String(name).trim();
  var sh = sheet(SHEET_CATEGORIES, CATEGORY_HEADERS);
  var values = sh.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]).trim() === name) return { ok: true, name: name, dup: true };
  }
  sh.appendRow([name]);
  return { ok: true, name: name };
}

function deleteCategory(name) {
  var sh = sheet(SHEET_CATEGORIES, CATEGORY_HEADERS);
  var values = sh.getDataRange().getValues();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]).trim() === String(name)) { sh.deleteRow(r + 1); break; }
  }
  return { ok: true, name: name };
}

/* ------------------------------------------------------------------ *
 *  Settings
 * ------------------------------------------------------------------ */

function getSettings() {
  var sh = sheet(SHEET_SETTINGS, SETTING_HEADERS);
  var out = {};
  tableToObjects(sh).forEach(function (r) { out[r.key] = r.value; });
  return out;
}

function setSetting(key, value) {
  var sh = sheet(SHEET_SETTINGS, SETTING_HEADERS);
  var values = sh.getDataRange().getValues();
  var found = false;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][0]) === String(key)) {
      sh.getRange(r + 1, 2).setValue(value);
      found = true;
    }
  }
  if (!found) sh.appendRow([key, value]);
  return { ok: true, key: key, value: value };
}

/* ------------------------------------------------------------------ *
 *  Drive images
 * ------------------------------------------------------------------ */

function ensureImageFolder() {
  var cfg = getSettings();
  if (cfg.imgFolderId) {
    try { return DriveApp.getFolderById(cfg.imgFolderId); } catch (e) {}
  }
  var folders = DriveApp.getFoldersByName(FOLDER_NAME);
  var folder;
  if (folders.hasNext()) folder = folders.next();
  else folder = DriveApp.createFolder(FOLDER_NAME);
  setSetting('imgFolderId', folder.getId());
  tryShareFolder(folder);
  return folder;
}

function tryShareFolder(folder) {
  try {
    if (typeof Drive !== 'undefined' && Drive.Files) {
      Drive.Files.update({ 'writersCanShare': false }, folder.getId(), null, { 'addParents': folder.getId(), 'supportsAllDrives': true });
      // update sharing with anyone-with-link (view)
      var body = {
        role: 'reader',
        type: 'anyone',
        allowFileDiscovery: false
      };
      Drive.Permissions.insert(body, folder.getId());
    }
  } catch (e) {
    Logger.log('share folder failed: %s', e.message);
  }
}

function uploadImage(b64, filename) {
  if (isBlank(b64)) throw new Error('ไม่มีข้อมูลรูปภาพ');
  var folder = ensureImageFolder();
  var name = (filename || 'img_' + uid('i') + '.jpg');
  var bytes = Utilities.base64Decode(String(b64).split(',')[1] || String(b64));
  var blob = Utilities.newBlob(bytes, 'image/jpeg', name);
  var file = folder.createFile(blob);
  var id = file.getId();
  var cfg = getSettings();
  // delete old image if re-uploading to same product is handled on the client; here we just return id
  return { ok: true, imgId: id };
}

function deleteImage(id) {
  if (!id) return { ok: true };
  try {
    var file = DriveApp.getFileById(String(id));
    file.setTrashed(true);
  } catch (e) {
    Logger.log('delete image %s failed: %s', id, e.message);
  }
  return { ok: true, id: id };
}

/* ------------------------------------------------------------------ *
 *  Helpers
 * ------------------------------------------------------------------ */

function num(v) {
  var n = parseFloat(String(v === undefined || v === null ? 0 : v).replace(/[^\d.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function round2(n) {
  return Math.round((num(n) + Number.EPSILON) * 100) / 100;
}

function jsonOk(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function jsonErr(msg) {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: msg })).setMimeType(ContentService.MimeType.JSON);
}
