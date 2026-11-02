// ตัวช่วยทดสอบเล็ก ๆ สำหรับรันด้วย JavaScriptCore (jsc) บน Mac ที่ไม่มี Node
var __passed = 0;
function eq(actual, expected, name) {
  var a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error("FAIL " + name + "\n  expected: " + e + "\n  actual:   " + a);
  __passed++;
  print("ok " + name);
}
