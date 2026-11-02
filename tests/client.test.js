// ทดสอบบล็อก PURE ใน apps-script/Index.html (คิวรอส่ง, การรวมข้อมูล, ข้อความเตือน)

var a = makeOp("add", {id: 1, date: "2026-11-03", fund: "FUND A", amount: 10000});
var q = enqueue([], a);
eq(enqueue(q, makeOp("del", {id: 1})).length, 0, "delete of queued add cancels both");
eq(q.length, 1, "enqueue does not change the old queue");
eq(enqueue(q, makeOp("del", {id: 9})).length, 2, "delete of a saved row is queued");

q = enqueue(enqueue([], makeOp("target", {value: 1})), makeOp("target", {value: 2}));
eq(q.length === 1 && q[0].payload.value === 2, true, "latest target replaces queued one");
q = enqueue(enqueue([], makeOp("funds", {list: ["A"]})), makeOp("funds", {list: ["A", "B"]}));
eq(q.length === 1 && q[0].payload.list.length === 2, true, "latest funds replaces queued one");

var v = overlay({target: 300000, purchases: [{id: 9, date: "2026-11-01", fund: "X", amount: 5}], customFunds: []}, [a]);
eq(v.purchases.map(function (p) { return [p.id, !!p.pending]; }), [[1, true], [9, false]], "queued add shown as pending, newest first");
eq(overlay({target: 0, purchases: [{id: 9, date: "2026-11-01", fund: "X", amount: 5}], customFunds: []},
  [makeOp("del", {id: 9})]).purchases.length, 0, "queued delete hides row");
v = overlay({target: 1, purchases: [], customFunds: ["A"]}, [makeOp("target", {value: 7}), makeOp("funds", {list: ["B"]})]);
eq([v.target, v.customFunds], [7, ["B"]], "queued target and funds are shown");

eq(classifyError("NetworkError: Connection failure due to HTTP 0", true), "offline", "network");
eq(classifyError("anything", false), "offline", "browser offline");
eq(classifyError("Access denied", true), "auth", "auth");
eq(classifyError("Exception: boom", true), "server", "server");

eq(statusBanner({loading: false, loadFailed: false, pending: 0, lastErrorKind: null}), null, "all good");
eq(statusBanner({loading: false, loadFailed: false, pending: 2, lastErrorKind: "offline"}).text,
  "มี 2 รายการยังไม่ได้บันทึกลง Google Sheet จะส่งให้เองเมื่อกลับมาออนไลน์", "pending offline copy");
eq(statusBanner({loading: false, loadFailed: false, pending: 1, lastErrorKind: "server"}).text,
  "มี 1 รายการยังไม่ได้บันทึกลง Google Sheet กำลังลองส่งใหม่", "pending server copy");
eq(statusBanner({loading: true, loadFailed: false, pending: 3, lastErrorKind: "auth"}).kind, "error", "auth outranks everything");
eq(statusBanner({loading: false, loadFailed: false, pending: 0, lastErrorKind: "auth"}).text,
  "บันทึกไม่ได้ เพราะบัญชี Google นี้ไม่มีสิทธิ์ใน Sheet ให้เข้าด้วยบัญชีที่ได้รับแชร์", "auth copy for shared accounts");
eq(statusBanner({loading: false, loadFailed: true, pending: 0, lastErrorKind: "offline"}).kind, "warn", "load failure warns");
eq(statusBanner({loading: true, loadFailed: false, pending: 0, lastErrorKind: null}),
  {kind: "info", text: "กำลังโหลดข้อมูลล่าสุดจาก Google Sheet"}, "loading info");

// --- จากการรีวิวรอบสุดท้าย ---
// #1 add ที่เคยส่งไปแล้ว (Sheet อาจได้รับแล้ว) ห้ามถูกตัดทิ้งตอนลบ ต้องส่งการลบตามไป
var sentAdd = makeOp("add", {id: 5, date: "2026-11-03", fund: "FUND A", amount: 1});
sentAdd.sent = true;
eq(enqueue([sentAdd], makeOp("del", {id: 5})).length, 2, "delete of a sent add is queued, not cancelled");

// #5 add ที่ค้างในคิวแต่ Sheet มีแล้ว ห้ามแสดงซ้ำ
eq(overlay({target: 0, purchases: [{id: 5, date: "2026-11-03", fund: "FUND A", amount: 1}], customFunds: []}, [sentAdd]).purchases.length,
  1, "queued add already on the server is not shown twice");

// #2 lock timeout ของ Apps Script เป็นปัญหาฝั่งเซิร์ฟเวอร์ ไม่ใช่เน็ตหลุด และทุกแบบที่ลองใหม่ได้ต้องมีเวลาลองใหม่
eq(classifyError("Lock timeout: another process was holding the lock for too long.", true), "server", "lock timeout is a server error");
eq([retryDelay(0), retryDelay(1), retryDelay(2), retryDelay(9)], [15000, 30000, 60000, 60000], "retry backoff 15s, 30s, then 60s cap");

// #3 Sheet ปฏิเสธถาวร ต้องแยกออกมา เพื่อเอาออกจากคิวแทนการลองซ้ำไม่จบ
eq(classifyError("Exception: REJECT: วันที่ต้องอยู่ในรูป YYYY-MM-DD", true), "rejected", "server validation is rejected");
eq(statusBanner({loading: false, loadFailed: false, pending: 0, lastErrorKind: null, rejectedText: "จำนวนเงินต้องมากกว่า 0"}),
  {kind: "warn", text: "มีรายการที่บันทึกไม่ได้และนำออกจากคิวแล้ว: จำนวนเงินต้องมากกว่า 0"}, "rejected op message");

// #6 ต้องอนุญาตสิทธิ์ใหม่ (เช่นหลังเปลี่ยน scope) ไม่ใช่ "ไม่มีสิทธิ์ใน Sheet"
eq(classifyError("Authorization is required to perform that action.", true), "reauth", "authorization required is reauth");
eq(classifyError("You do not have permission to access the requested document.", true), "auth", "no permission is auth");
eq(statusBanner({loading: false, loadFailed: false, pending: 1, lastErrorKind: "reauth"}),
  {kind: "error", text: "ต้องอนุญาตสิทธิ์ใหม่ ให้ปิดแอปแล้วเปิดใหม่ แล้วกดอนุญาต"}, "reauth message");

print("client: " + __passed + " passed");
