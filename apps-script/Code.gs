/** @OnlyCurrentDoc */
/**
 * กองทุนลดหย่อนภาษี: Apps Script backend
 * ผูกกับ Google Sheet ที่เก็บข้อมูลตัวจริง
 * deploy: Execute as = User accessing the web app, Who has access = Anyone with Google account
 * ใครเปิดแอปได้ คุมด้วยการแชร์ Sheet แบบ Editor (ห้ามใช้ Execute as Me คู่กับ Anyone)
 * @OnlyCurrentDoc จำกัดสิทธิ์ให้แตะได้เฉพาะ Sheet นี้ ไม่ใช่ทุก Sheet ของคนที่เปิด
 *
 * แท็บ Purchases : แถว 1 = id | date | fund | amount | createdAt  (date เก็บเป็นข้อความ YYYY-MM-DD)
 * แท็บ Settings  : A1 "target"      B1 = เป้าหมายทั้งปี (บาท)
 *                  A2 "customFunds" B2 = รายชื่อกองทุนที่พิมพ์เอง เป็นข้อความ JSON
 *
 * ทุกฟังก์ชันที่หน้าเว็บเรียกผ่าน google.script.run อยู่ด้านล่าง
 * การเขียนทุกครั้งถือ ScriptLock กันการบันทึกซ้อนกัน
 * ข้อมูลผิดรูปจะ throw ข้อความขึ้นต้นด้วย REJECT: หน้าเว็บจะเอาออกจากคิวแทนการลองซ้ำ
 */
var PURCHASES = 'Purchases';
var SETTINGS = 'Settings';
var HEADER = ['id', 'date', 'fund', 'amount', 'createdAt'];
var TZ = 'Asia/Bangkok';

function doGet() {
  // ไม่ตั้ง XFrameOptionsMode เป็น ALLOWALL (บทเรียนจาก PBS WebApp: Android จะได้ไอคอน G แทนไอคอนแอป)
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('กองทุนลดหย่อนภาษี')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1');
}

// ---------- อ่าน ----------
function getData() {
  ensureSheets_();
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(PURCHASES);
  var purchases = [];
  var last = sh.getLastRow();
  if (last > 1) {
    sh.getRange(2, 1, last - 1, 4).getValues().forEach(function (r) {
      if (r[0] === '' || r[0] === null) return;
      purchases.push({ id: Number(r[0]), date: toDateText_(r[1]), fund: String(r[2]), amount: toNumber_(r[3]) });
    });
  }
  purchases.sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.id - a.id;
  });
  var s = ss.getSheetByName(SETTINGS).getRange(1, 1, 2, 2).getValues();
  var funds = [];
  try { funds = JSON.parse(s[1][1] || '[]'); } catch (e) { funds = []; }
  return { target: toNumber_(s[0][1]), purchases: purchases, customFunds: Array.isArray(funds) ? funds : [] };
}

// ---------- เขียน ----------
function addPurchase(p) {
  if (!p || !(Number(p.id) > 0)) reject_('รายการไม่มีรหัส');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.date))) reject_('วันที่ต้องอยู่ในรูป YYYY-MM-DD');
  if (!(Number(p.amount) > 0) || !isFinite(Number(p.amount))) reject_('จำนวนเงินต้องมากกว่า 0');
  return withLock_(function () {
    var sh = ensureSheets_().getSheetByName(PURCHASES);
    if (findRow_(sh, Number(p.id)) > 0) return { ok: true, duplicate: true };
    sh.appendRow([Number(p.id), String(p.date), String(p.fund || 'อื่นๆ'), Number(p.amount), new Date().toISOString()]);
    return { ok: true, duplicate: false };
  });
}

function deletePurchase(id) {
  return withLock_(function () {
    var sh = ensureSheets_().getSheetByName(PURCHASES);
    var row = findRow_(sh, Number(id));
    if (row > 0) sh.deleteRow(row);
    return { ok: true, found: row > 0 };
  });
}

function setTarget(value) {
  var v = Number(value);
  if (!(v >= 0) || !isFinite(v)) reject_('เป้าหมายต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
  return withLock_(function () {
    ensureSheets_().getSheetByName(SETTINGS).getRange(1, 1, 1, 2).setValues([['target', v]]);
    return { ok: true };
  });
}

function setCustomFunds(list) {
  if (!Array.isArray(list)) reject_('รายชื่อกองทุนไม่ถูกต้อง');
  var clean = list.map(String);
  return withLock_(function () {
    ensureSheets_().getSheetByName(SETTINGS).getRange(2, 1, 1, 2).setValues([['customFunds', JSON.stringify(clean)]]);
    return { ok: true };
  });
}

// ---------- ตัวช่วย ----------
function reject_(message) { throw new Error('REJECT: ' + message); }

function ensureSheets_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(PURCHASES);
  if (!sh) sh = ss.insertSheet(PURCHASES);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
    sh.getRange(1, 2, 1000, 1).setNumberFormat('@');
  }
  var st = ss.getSheetByName(SETTINGS);
  if (!st) st = ss.insertSheet(SETTINGS);
  if (st.getLastRow() === 0) st.getRange(1, 1, 2, 2).setValues([['target', 0], ['customFunds', '[]']]);
  return ss;
}

function findRow_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (Number(ids[i][0]) === id) return i + 2;
  return -1;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function toDateText_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v);
}

function toNumber_(v) {
  if (typeof v === 'number') return v;
  var n = Number(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}
