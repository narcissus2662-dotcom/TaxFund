// ทดสอบ apps-script/Code.gs กับ Sheet ปลอมจาก tests/fakes.js

resetFake({});
eq(getData(), {target: 0, purchases: [], customFunds: []}, "empty sheet creates tabs");
eq(addPurchase({id: 1, date: "2026-11-03", fund: "FUND A", amount: 10000}), {ok: true, duplicate: false}, "add");
eq(addPurchase({id: 1, date: "2026-11-03", fund: "FUND A", amount: 10000}), {ok: true, duplicate: true}, "same id twice is not duplicated");
eq(getData().purchases.length, 1, "still one row");
eq(deletePurchase(1), {ok: true, found: true}, "delete");
eq(deletePurchase(1), {ok: true, found: false}, "delete again is safe");
setTarget(300000);
eq(getData().target, 300000, "target");
setCustomFunds(["FUND A"]);
eq(getData().customFunds, ["FUND A"], "custom funds");

resetFake({Purchases: [["id", "date", "fund", "amount", "createdAt"],
  [2, new Date(2026, 9, 26), "FUND B", "10,000", ""], ["", "", "", "", ""],
  [3, "2026-10-26", "FUND A", 5000, ""]]});
eq(getData().purchases, [{id: 3, date: "2026-10-26", fund: "FUND A", amount: 5000},
  {id: 2, date: "2026-10-26", fund: "FUND B", amount: 10000}], "date objects, text amounts, blank rows, order");

var threw = false;
try { addPurchase({id: 4, date: "26/10/2026", fund: "X", amount: 1}); } catch (e) { threw = true; }
eq(threw, true, "bad date rejected");
threw = false;
try { addPurchase({id: 5, date: "2026-10-26", fund: "X", amount: 0}); } catch (e) { threw = true; }
eq(threw, true, "zero amount rejected");

// #3 ข้อมูลผิดรูปต้องขึ้นต้นด้วย REJECT: ให้หน้าเว็บรู้ว่าไม่ต้องลองซ้ำ
var msg = "";
try { addPurchase({id: 6, date: "2026-10-26", fund: "X", amount: Infinity}); } catch (e) { msg = e.message; }
eq(msg.indexOf("REJECT:"), 0, "infinite amount rejected with REJECT prefix");
msg = "";
try { setTarget(-1); } catch (e) { msg = e.message; }
eq(msg.indexOf("REJECT:"), 0, "negative target rejected with REJECT prefix");

print("server: " + __passed + " passed");
