# ย้ายที่เก็บข้อมูลไป Google Sheet: แผนลงมือ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทุกรายการซื้อถูกเขียนลง Google Sheet ก่อนที่แอปจะบอกว่าบันทึกแล้ว ล้าง Chrome แล้วข้อมูลไม่หาย

**Architecture:** ตัวแอปย้ายไปเป็น Google Apps Script web app ที่ผูกกับ Sheet (Execute as Me, Only myself) ฝั่งเซิร์ฟเวอร์ `Code.gs` อ่านเขียน Sheet ส่วนฝั่งหน้าเว็บ `Index.html` คุยกับเซิร์ฟเวอร์ผ่าน `google.script.run` ทุกการเปลี่ยนแปลงเข้าคิวในเครื่องก่อน แล้วส่งตามลำดับ รายการจะหายจากคิวเมื่อเซิร์ฟเวอร์ยืนยันแล้วเท่านั้น

> หมายเหตุ 2 พ.ย. 2026: หลัง deploy ได้เปลี่ยนเป็น Execute as = User accessing และ Anyone with Google account แล้วคุมสิทธิ์ด้วยการแชร์ Sheet ดูหัวข้อ "ที่เก็บและการเข้าถึง" ใน spec

**Tech Stack:** Google Apps Script (V8), HTML/CSS/vanilla JS ไฟล์เดียว, ทดสอบบน Mac ด้วย JavaScriptCore (`jsc`) เพราะเครื่องไม่มี Node

**Spec:** `docs/superpowers/specs/2026-11-02-sheet-storage-design.md`

## สรุปสำหรับ Nate

| ขั้น | ใครทำ | ได้อะไร |
|---|---|---|
| 1 | Claude | สร้าง Google Sheet ในบัญชีหลักของคุณ แล้วใส่ 27 รายการ พร้อมรายการใหม่ ถ้ามี |
| 2 | Claude | โค้ดฝั่ง Sheet พร้อมชุดทดสอบ |
| 3 | Claude | ตัวคิดคำนวณฝั่งแอป เช่น คิวรอส่งและข้อความเตือน พร้อมชุดทดสอบ |
| 4 | Claude | ตัวแอปหน้าตาเดิม ต่อกับ Sheet |
| 5 | **Nate** (ประมาณ 10 นาที) | วางโค้ดใน Apps Script แล้วกด Deploy ตามคู่มือภาษาไทย แล้วลองบนมือถือ |
| 6 | Claude | เปลี่ยนลิงก์ Netlify เดิมเป็นหน้าแจ้งย้าย และ commit (ถามก่อน push) |

## Global Constraints

- ห้าม commit ตัวเลขการเงินจริง อีเมล รหัส หรือ key ลง repo เพราะ repo และเว็บ Netlify เป็นสาธารณะ ข้อมูลจริงอยู่ใน `recovered-data-2026-11-02.json` ซึ่งถูก exclude แล้ว
- ข้อความในแอปเป็นภาษาไทย ห้าม em dash และ en dash ในข้อความ
- ใช้ฟอนต์ Kanit และชุดสีเดิมใน `:root` ของ `index.html` องค์ประกอบใหม่ห้ามใช้ emoji เป็นไอคอน
- Supabase, ปุ่มนำเข้า ปุ่มส่งออก และปุ่มล้างข้อมูลทั้งหมด ไม่มีในแอปใหม่
- `doGet` ห้ามตั้ง `XFrameOptionsMode.ALLOWALL` (PBS WebApp เคยเจอว่าทำให้ Android ได้ไอคอน G)
- งานอยู่บน branch ปัจจุบัน (`main`) ตามที่ Nate เลือก ทุก commit ต้องถาม Nate ก่อน และห้าม push จนกว่าจะถึงขั้น 6 เพราะ push แล้ว Netlify เปลี่ยนเว็บจริงทันที

## Review Focus

1. ส่งซ้ำหลังหมดเวลา แต่เซิร์ฟเวอร์บันทึกไปแล้ว ต้องไม่ได้รายการซ้ำ ทดสอบใน Task 2 (`addPurchase` เรียกด้วย id เดิมสองครั้ง)
2. ลบรายการที่ยังรอส่งอยู่ในคิว คิวต้องตัดทั้งการเพิ่มและการลบทิ้ง ไม่ส่งอะไรเลย ทดสอบใน Task 3 (`enqueue`)
3. เปิดด้วยบัญชีผิดหรือหมดสิทธิ์ ต้องขึ้นข้อความเรื่องบัญชี ไม่ใช่ "จะลองใหม่" ไปเรื่อย ๆ ทดสอบใน Task 3 (`classifyError`, `statusBanner`)
4. Sheet แปลงวันที่ที่เป็นข้อความเป็นวันที่เอง หรือมีแถวว่างหรือยอดเงินเป็นข้อความ `getData` ต้องคืน `YYYY-MM-DD` และตัวเลขเสมอ และข้ามแถวว่าง ทดสอบใน Task 2
5. เปิดแอปตอนโหลด Sheet ไม่ได้ ต้องเห็นข้อมูลล่าสุดที่เก็บไว้ในเครื่องพร้อมคำเตือน ไม่ใช่หน้าว่าง ทดสอบใน Task 3 (`statusBanner`) และตรวจด้วยมือใน Task 5

---

### Task 1: สร้าง Google Sheet และใส่ข้อมูลตั้งต้น

ขั้นนี้ไม่มีโค้ดใน repo เป็นงานข้อมูลผ่าน connector ของ Google Drive และ Sheets

**Files:** อ่านอย่างเดียว `recovered-data-2026-11-02.json`

**Produces:** Sheet ชื่อ `กองทุนลดหย่อนภาษี (ข้อมูล)` มีแท็บ `Purchases` และ `Settings` ตามโครงใน Task 2

- [ ] **Step 1: เช็กว่า connector เป็นบัญชีหลักของ Nate**
สร้างไฟล์ด้วย Drive connector แล้วอ่านสิทธิ์ไฟล์ (`get_file_permissions`) owner ต้องเป็นบัญชีที่รับอีเมลธนาคาร ถ้าไม่ใช่ ให้หยุดแล้วถาม Nate และห้ามใส่ข้อมูล

- [ ] **Step 2: เช็กรายการซื้อใหม่ตั้งแต่ 2 พ.ย.**
ค้น Gmail หาอีเมลยืนยันคำสั่งซื้อกองทุนจากธนาคารทั้งสองแห่ง ตั้งแต่ 2 พ.ย. 2026 ถ้าเจอ ให้รวมเข้าข้อมูลแล้วส่งรายการให้ Nate ตรวจก่อน

- [ ] **Step 3: เขียนหัวคอลัมน์และข้อมูล**
`Purchases!A1:E1` = `id, date, fund, amount, createdAt` ตั้งรูปแบบคอลัมน์ B เป็นข้อความ (`@`) ก่อนใส่ข้อมูล จากนั้นใส่ทุกแถว โดยให้ `createdAt` เป็นเวลาที่ใส่
`Settings!A1:B2` = `target | <เป้าจากข้อมูลที่กู้มา>` และ `customFunds | <รายชื่อกองทุนจากข้อมูลที่กู้มา เป็นข้อความ JSON>`

- [ ] **Step 4: ตรวจ**
อ่านกลับด้วย `get_values` แล้วเทียบกับไฟล์ JSON ด้วยสคริปต์: จำนวนแถว ยอดรวม และ id ไม่ซ้ำ ต้องตรงกันทั้งหมด

---

### Task 2: ฝั่งเซิร์ฟเวอร์ `Code.gs` และชุดทดสอบ

**Files:**
- Create: `apps-script/Code.gs`
- Create: `tests/assert.js`, `tests/fakes.js`, `tests/server.test.js`, `tests/run.sh`

**Interfaces (Produces):**
```js
getData()                 // -> { target: number, purchases: [{id:number, date:"YYYY-MM-DD", fund:string, amount:number}], customFunds: string[] }
addPurchase(p)            // p = {id, date, fund, amount} -> { ok: true, duplicate: boolean }
deletePurchase(id)        // -> { ok: true, found: boolean }
setTarget(value)          // value: number >= 0 -> { ok: true }
setCustomFunds(list)      // list: string[] -> { ok: true }
```
ทุกฟังก์ชันเขียนเรียก `ensureSheets_()` ที่สร้างแท็บและหัวคอลัมน์ถ้ายังไม่มี และถือ `LockService.getScriptLock()` (`waitLock(10000)`, ปล่อยใน `finally`) ส่วน `getData` คืนรายการเรียงตามวันที่ใหม่ไปเก่า ถ้าวันเดียวกันเรียง id มากไปน้อย ข้อมูลผิดรูปให้ `throw new Error(<ข้อความไทย>)`

- [ ] **Step 1: เขียนตัวช่วยทดสอบและของปลอม**
`tests/assert.js`: `eq(actual, expected, name)` เทียบด้วย `JSON.stringify` ถ้าไม่ตรงให้ throw พร้อมชื่อทดสอบ ถ้าตรงให้ `print("ok " + name)`
`tests/fakes.js`: `SpreadsheetApp.getActive()` คืน spreadsheet ปลอมที่เก็บแต่ละแท็บเป็นตาราง 2 มิติ รองรับ `getSheetByName`, `insertSheet`, `getDataRange().getValues()`, `getRange(r,c,nr,nc).getValues()/setValues()/setNumberFormat()`, `appendRow`, `deleteRow`, `getLastRow`; `LockService.getScriptLock()` คืน `{waitLock(){}, releaseLock(){}}`; `Utilities.formatDate(d, tz, fmt)` สำหรับ `yyyy-MM-dd`; และ `resetFake(tabs)` สำหรับตั้งค่าตั้งต้นแต่ละทดสอบ

- [ ] **Step 2: เขียนทดสอบที่ต้องล้มก่อน** ใน `tests/server.test.js`
```js
resetFake({});
eq(getData(), {target:0, purchases:[], customFunds:[]}, "empty sheet creates tabs");
eq(addPurchase({id:1, date:"2026-11-03", fund:"FUND A", amount:10000}), {ok:true, duplicate:false}, "add");
eq(addPurchase({id:1, date:"2026-11-03", fund:"FUND A", amount:10000}), {ok:true, duplicate:true}, "same id twice is not duplicated");
eq(getData().purchases.length, 1, "still one row");
eq(deletePurchase(1), {ok:true, found:true}, "delete");
eq(deletePurchase(1), {ok:true, found:false}, "delete again is safe");
setTarget(300000); eq(getData().target, 300000, "target");
setCustomFunds(["FUND A"]); eq(getData().customFunds, ["FUND A"], "custom funds");
resetFake({Purchases:[["id","date","fund","amount","createdAt"],
  [2, new Date(2026,9,26), "FUND B", "10,000", ""], ["", "", "", "", ""],
  [3, "2026-10-26", "FUND A", 5000, ""]]});
eq(getData().purchases, [{id:3,date:"2026-10-26",fund:"FUND A",amount:5000},
  {id:2,date:"2026-10-26",fund:"FUND B",amount:10000}], "date objects, text amounts, blank rows, order");
var threw=false; try{ addPurchase({id:4, date:"26/10/2026", fund:"X", amount:1}); }catch(e){ threw=true; }
eq(threw, true, "bad date rejected");
threw=false; try{ addPurchase({id:5, date:"2026-10-26", fund:"X", amount:0}); }catch(e){ threw=true; }
eq(threw, true, "zero amount rejected");
```
`tests/run.sh` (ใช้ `set -e`): `JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc` คัดลอก `apps-script/Code.gs` ไปเป็นไฟล์ `.js` ชั่วคราว แล้วรัน `$JSC tests/assert.js tests/fakes.js <copy> tests/server.test.js`

- [ ] **Step 3: รันให้เห็นว่าล้ม**
Run: `bash tests/run.sh`
Expected: FAIL เพราะ `getData` is not defined

- [ ] **Step 4: เขียน `apps-script/Code.gs`**
ใช้ interface ข้างบน บวก `doGet()` แบบ PBS (`HtmlService.createHtmlOutputFromFile('Index').setTitle('กองทุนลดหย่อนภาษี').addMetaTag('viewport', ...)`) ตอนอ่าน ถ้าเซลล์วันที่เป็น `Date` ให้แปลงด้วย `Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd')` ยอดเงินให้ตัด `,` แล้วแปลงเป็นตัวเลข ส่วนแถวที่ id ว่างให้ข้าม

- [ ] **Step 5: รันให้ผ่าน**
Run: `bash tests/run.sh`
Expected: ทุกบรรทัดขึ้น `ok` และ exit 0

- [ ] **Step 6: ถาม Nate แล้ว commit**
```bash
git add apps-script/Code.gs tests/
git commit -m "Add Apps Script backend that stores purchases in Google Sheet"
```

---

### Task 3: ตัวคิดคำนวณฝั่งแอปและชุดทดสอบ

โค้ดส่วนนี้อยู่ใน `apps-script/Index.html` ระหว่างคอมเมนต์ `/* PURE-START */` กับ `/* PURE-END */` ห้ามแตะ DOM หรือ `google.script.run` เพื่อให้ทดสอบด้วย `jsc` ได้

**Files:**
- Create: `apps-script/Index.html` (เฉพาะบล็อก PURE ในขั้นนี้)
- Create: `tests/client.test.js`
- Modify: `tests/run.sh` (ดึงบล็อก PURE ด้วย `sed -n '/PURE-START/,/PURE-END/p'` แล้วรันกับ `tests/assert.js tests/client.test.js`)

**Interfaces (Produces):**
```js
makeOp(type, payload)       // type: "add"|"del"|"target"|"funds" -> { opId: string, type, payload }
enqueue(queue, op)          // -> คิวใหม่ (ไม่แก้ของเดิม)
overlay(server, queue)      // -> { target, purchases (รายการรอส่งมี pending:true), customFunds }
classifyError(message, online) // -> "offline"|"auth"|"server"
statusBanner(s)             // s = { loading, loadFailed, pending, lastErrorKind } -> null | { kind: "info"|"warn"|"error", text }
```
รูปของ `payload`: `add` คือ `{id, date, fund, amount}`, `del` คือ `{id}`, `target` คือ `{value}`, `funds` คือ `{list}` และตอนส่งจริงให้เรียก `addPurchase(payload)`, `deletePurchase(payload.id)`, `setTarget(payload.value)`, `setCustomFunds(payload.list)` ตามลำดับ
กติกา `overlay`: ใช้ op ที่ค้างในคิวทับข้อมูลจากเซิร์ฟเวอร์ทุกชนิด รวมถึง `target` และ `funds`
กติกา `enqueue`: ถ้า `del` ของ id ที่ `add` ยังค้างอยู่ในคิว ให้ตัดทิ้งทั้งคู่ ส่วน `target` และ `funds` ตัวใหม่ให้แทนตัวที่ค้างอยู่ ไม่ต่อท้าย
กติกา `classifyError`: `online === false` หรือข้อความตรง `/network|http 0|failed to fetch|timeout/i` เป็น `"offline"` ถ้าตรง `/authoriz|permission|access denied|401|403|ไม่มีสิทธิ์/i` เป็น `"auth"` นอกนั้นเป็น `"server"`

ข้อความของ `statusBanner` ใช้ตามนี้ทุกตัวอักษร (N คือจำนวนที่รอส่ง):

| เงื่อนไข (เรียงตามลำดับความสำคัญ) | kind | text |
|---|---|---|
| `lastErrorKind === "auth"` | error | `บันทึกไม่ได้ เพราะบัญชี Google ไม่ตรงกับเจ้าของข้อมูล ให้ออกจากระบบแล้วเข้าด้วยบัญชีหลัก` |
| `loadFailed` | warn | `โหลดข้อมูลจาก Google Sheet ไม่ได้ ตัวเลขที่เห็นอาจไม่ใช่ล่าสุด` |
| `pending > 0 && lastErrorKind === "offline"` | warn | `มี N รายการยังไม่ได้บันทึกลง Google Sheet จะส่งให้เองเมื่อกลับมาออนไลน์` |
| `pending > 0 && lastErrorKind === "server"` | warn | `มี N รายการยังไม่ได้บันทึกลง Google Sheet กำลังลองส่งใหม่` |
| `loading` | info | `กำลังโหลดข้อมูลล่าสุดจาก Google Sheet` |
| อื่น ๆ | | `null` |

- [ ] **Step 1: เขียนทดสอบที่ต้องล้มก่อน** ใน `tests/client.test.js`
```js
var a = makeOp("add", {id:1, date:"2026-11-03", fund:"FUND A", amount:10000});
var q = enqueue([], a);
eq(enqueue(q, makeOp("del", {id:1})).length, 0, "delete of queued add cancels both");
q = enqueue(enqueue([], makeOp("target",{value:1})), makeOp("target",{value:2}));
eq(q.length === 1 && q[0].payload.value === 2, true, "latest target replaces queued one");
var v = overlay({target:300000, purchases:[{id:9,date:"2026-11-01",fund:"X",amount:5}], customFunds:[]}, [a]);
eq(v.purchases.map(function(p){return [p.id, !!p.pending];}), [[1,true],[9,false]], "queued add shown as pending, newest first");
eq(overlay({target:0,purchases:[{id:9,date:"2026-11-01",fund:"X",amount:5}],customFunds:[]}, [makeOp("del",{id:9})]).purchases.length, 0, "queued delete hides row");
eq(classifyError("NetworkError: Connection failure due to HTTP 0", true), "offline", "network");
eq(classifyError("anything", false), "offline", "browser offline");
eq(classifyError("Authorization is required to perform that action.", true), "auth", "auth");
eq(classifyError("Exception: boom", true), "server", "server");
eq(statusBanner({loading:false,loadFailed:false,pending:0,lastErrorKind:null}), null, "all good");
eq(statusBanner({loading:false,loadFailed:false,pending:2,lastErrorKind:"offline"}).text,
   "มี 2 รายการยังไม่ได้บันทึกลง Google Sheet จะส่งให้เองเมื่อกลับมาออนไลน์", "pending offline copy");
eq(statusBanner({loading:true,loadFailed:false,pending:3,lastErrorKind:"auth"}).kind, "error", "auth outranks everything");
eq(statusBanner({loading:false,loadFailed:true,pending:0,lastErrorKind:"offline"}).kind, "warn", "load failure warns");
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**
Run: `bash tests/run.sh`
Expected: ส่วน server ผ่าน ส่วน client FAIL เพราะ `makeOp` is not defined

- [ ] **Step 3: เขียนบล็อก PURE ใน `apps-script/Index.html`**
`opId` ใช้เวลาบวกตัวสุ่มก็พอ ส่วน `overlay` เรียงรายการแบบเดียวกับ `getData`

- [ ] **Step 4: รันให้ผ่าน**
Run: `bash tests/run.sh`
Expected: ทุกบรรทัดขึ้น `ok` และ exit 0

- [ ] **Step 5: ถาม Nate แล้ว commit**
```bash
git add apps-script/Index.html tests/
git commit -m "Add offline queue and status logic for the Sheet-backed app"
```

---

### Task 4: ตัวแอป `Index.html` ต่อกับ Sheet

**Files:**
- Modify: `apps-script/Index.html` (เติมส่วน HTML, CSS และ JS ที่แตะ DOM รอบบล็อก PURE)
- อ่านเป็นต้นแบบ: `index.html` (ห้ามแก้ในขั้นนี้)

**Interfaces (Consumes):** ฟังก์ชันเซิร์ฟเวอร์จาก Task 2 และฟังก์ชัน PURE จาก Task 3

- [ ] **Step 1: ยกหน้าตาเดิมมา**
คัดลอก `<head>`, CSS และ markup จาก `index.html` มา แล้วตัด `exportBtn`, `importBtn`, `syncBtn`, `resetBtn`, modal ทั้งสามตัว และ CSS `.sync-*`, `.modal-backdrop` ที่ไม่มีใครใช้แล้ว ตัด JS ส่วน cloud sync, import, export, `loadData`/`saveData`/`persist` และ `window.storage` ส่วน render, totals, pace, chips และ list ให้คงไว้ แต่เปลี่ยนให้อ่านจาก `view = overlay(server, queue)`

- [ ] **Step 2: แถบสถานะและป้ายรายการรอส่ง**
เพิ่ม `<div id="statusBar" hidden></div>` ใต้ `.hdr` แล้วแสดงตาม `statusBanner(...)` ใช้สีพื้นจากชุดเดิม (info ใช้ `#E8EAFD`/`var(--cobalt)`, warn ใช้ `#FFE9C2`/`#8A5A00`, error ใช้ `#FFE1DD`/`#B5321F` ตัวหนังสือผ่าน WCAG AA ตามกติกาใน `CLAUDE.md`) รายการที่ `pending` แสดงป้ายข้อความ `กำลังบันทึก` ระหว่างส่ง และ `ยังไม่ได้บันทึก` ถ้าส่งรอบล่าสุดไม่สำเร็จ

- [ ] **Step 3: ต่อการกระทำเข้าคิว**
`addPurchase` ให้ enqueue `add` (id = `Date.now()`) ถ้าเป็นกองทุนใหม่ให้ enqueue `funds` ด้วย ปุ่มลบให้ enqueue `del` การตั้งเป้าให้ enqueue `target` และปุ่ม ✕ ที่ชิปให้ enqueue `funds` ทุกครั้งต้องบันทึกคิวลง `localStorage['taxfund:queue']` (ครอบด้วย try/catch) แล้ว render แล้วเรียก `flush()`

- [ ] **Step 4: โหลดและส่ง**
ตอนเปิดแอป: render จาก `localStorage['taxfund:cache']` พร้อม `loading:true` แล้วเรียก `getData` ถ้าสำเร็จให้เก็บ cache แล้ว render ถ้าล้มให้ตั้ง `loadFailed`
`flush()`: ถ้ากำลังส่งอยู่ให้ออก ส่ง op ทีละตัวตามลำดับผ่าน promise ที่ห่อ `google.script.run` สำเร็จแล้วค่อยเอาออกจากคิว ถ้าล้มให้ตั้ง `lastErrorKind = classifyError(...)` แล้วหยุด เมื่อคิวว่างให้โหลด `getData` ใหม่หนึ่งรอบ
ให้เรียก `flush()` ตอนเปิดแอปหลังโหลดเสร็จ ตอน `window` ได้ event `online` และตอน `visibilitychange` กลับมาเห็นหน้า ถ้า error เป็นแบบ `auth` ห้ามลองส่งซ้ำอัตโนมัติ

- [ ] **Step 5: ตรวจโค้ด**
Run: `bash tests/run.sh` แล้วรัน syntax check ของสคริปต์ทั้งไฟล์ด้วย `jsc` (`new Function(...)` แบบใน `CLAUDE.md`) โดยชี้ไปที่ `apps-script/Index.html`
Expected: ทดสอบผ่านทั้งหมด และขึ้น `JS OK`

- [ ] **Step 6: ลองหน้าตาในเบราว์เซอร์ในแอป**
เปิด `apps-script/Index.html` ด้วย stub `google.script.run` ชั่วคราวที่คืนข้อมูลปลอม (stub อยู่ใน scratchpad ห้าม commit) แล้วเช็กสามสถานะ คือปกติ รอส่งตอนออฟไลน์ และบัญชีผิด ส่ง screenshot ทั้งสามให้ Nate ดู

- [ ] **Step 7: ถาม Nate แล้ว commit**
```bash
git add apps-script/Index.html
git commit -m "Port the tracker UI to Apps Script with queued saves to Google Sheet"
```

---

### Task 5: คู่มือ deploy และลองบนมือถือจริง

**Files:**
- Create: `apps-script/DEPLOY.md`

- [ ] **Step 1: เขียน `apps-script/DEPLOY.md` เป็นภาษาไทยทีละขั้น** ตามแบบ `PF/PBS WebApp/DEPLOY_appscript.md` คือเปิด Sheet จาก Task 1 ไปที่ Extensions แล้ว Apps Script วาง `Code.gs` สร้างไฟล์ HTML ชื่อ `Index` แล้ววางโค้ด จากนั้น Deploy เป็น Web app (Execute as Me, Only myself) กด Authorize แล้วคัดลอก URL ไปเพิ่มลงหน้าจอโฮม และมีส่วนวิธีอัปเดตโค้ดโดยใช้ URL เดิม (Manage deployments แล้วเลือก New version)

- [ ] **Step 2: Nate deploy** แล้วส่ง Web app URL มาให้

- [ ] **Step 3: Nate ลองบนมือถือตามรายการตรวจในเอกสารออกแบบ** ผมเตรียมรายการให้ติ๊ก และเช็กฝั่ง Sheet ผ่าน connector ทุกข้อ
  1. บันทึกรายการทดสอบ ฿1 แล้วเห็นแถวใหม่ใน Sheet จากนั้นลบทิ้ง แถวนั้นต้องหายจาก Sheet ด้วย
  2. ล้าง "คุกกี้และข้อมูลเว็บไซต์" แล้วเปิดแอป ล็อกอิน Google แล้วเห็น 27 รายการครบ
  3. เปิดโหมดเครื่องบินแล้วบันทึก ต้องขึ้นแถบเตือนรอส่ง พอปิดโหมดเครื่องบิน รายการถึง Sheet เพียงแถวเดียว
  4. เปิด URL ในหน้าต่างไม่ระบุตัวตนด้วยบัญชีอื่น ต้องเข้าไม่ได้

- [ ] **Step 4: ถาม Nate แล้ว commit**
```bash
git add apps-script/DEPLOY.md
git commit -m "Add Thai deploy guide for the Apps Script app"
```

---

### Task 6: ปิดลิงก์ Netlify เดิม และอัปเดตเอกสารโปรเจกต์

ทำหลัง Task 5 ผ่านครบแล้วเท่านั้น

**Files:**
- Modify: `index.html` (แทนทั้งไฟล์ด้วยหน้าแจ้งย้าย)
- Modify: `CLAUDE.md`

- [ ] **Step 1: เช็กข้อมูลค้างก่อนปิด** ถาม Nate ว่าหลังวันที่ 2 พ.ย. เคยบันทึกในลิงก์เก่าไหม ถ้าเคย ให้ดึงรายการใหม่จากอีเมลธนาคารเข้า Sheet ก่อน แบบ Task 1 Step 2

- [ ] **Step 2: เขียนหน้าแจ้งย้าย** ไฟล์เดียว ใช้ฟอนต์และสีเดิม ข้อความ `แอปย้ายไปเก็บข้อมูลใน Google Sheet แล้ว` และปุ่ม `เปิดแอปใหม่` ลิงก์ไปที่ Web app URL ไม่มีช่องกรอก ไม่อ่านหรือเขียน storage

- [ ] **Step 3: อัปเดต `CLAUDE.md`** ให้บรรยายโครงใหม่ (ไฟล์ใน `apps-script/`, Sheet คือที่เก็บตัวจริง, วิธีรัน `bash tests/run.sh`, วิธีอัปเดตโค้ดบน Apps Script) และตัดส่วน Supabase กับ dual-mode storage ออก

- [ ] **Step 4: ตรวจ** เปิดหน้าแจ้งย้ายในเบราว์เซอร์ในแอป แล้วเช็กว่าปุ่มลิงก์ถูก และใน console ไม่มี error

- [ ] **Step 5: ถาม Nate แล้ว commit และ push**
```bash
git add index.html CLAUDE.md docs/
git commit -m "Point the old Netlify link to the new Sheet-backed app"
git push
```
push แล้ว Netlify จะเปลี่ยนเว็บจริงเป็นหน้าแจ้งย้ายทันที
