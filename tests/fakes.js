// ของปลอมแทน SpreadsheetApp / LockService / Utilities ของ Apps Script
// แต่ละแท็บเก็บเป็นตาราง 2 มิติ ใช้กับ tests/server.test.js เท่านั้น
var __tabs = {};

function resetFake(tabs) {
  __tabs = {};
  for (var k in tabs) __tabs[k] = tabs[k].map(function (r) { return r.slice(); });
}

function FakeSheet(name) { this.name = name; }
FakeSheet.prototype._rows = function () { return __tabs[this.name]; };
FakeSheet.prototype.getLastRow = function () {
  var rows = this._rows();
  for (var i = rows.length - 1; i >= 0; i--) {
    if (rows[i].some(function (v) { return v !== "" && v !== null && v !== undefined; })) return i + 1;
  }
  return 0;
};
FakeSheet.prototype.getRange = function (r, c, nr, nc) {
  var sheet = this;
  nr = nr || 1; nc = nc || 1;
  return {
    getValues: function () {
      var rows = sheet._rows(), out = [];
      for (var i = 0; i < nr; i++) {
        var row = rows[r - 1 + i] || [], cells = [];
        for (var j = 0; j < nc; j++) {
          var v = row[c - 1 + j];
          cells.push(v === undefined || v === null ? "" : v);
        }
        out.push(cells);
      }
      return out;
    },
    setValues: function (vals) {
      var rows = sheet._rows();
      for (var i = 0; i < vals.length; i++) {
        while (rows.length < r + i) rows.push([]);
        for (var j = 0; j < vals[i].length; j++) rows[r - 1 + i][c - 1 + j] = vals[i][j];
      }
      return this;
    },
    setNumberFormat: function () { return this; }
  };
};
FakeSheet.prototype.getDataRange = function () {
  var last = this.getLastRow(), width = 0;
  this._rows().slice(0, last).forEach(function (r) { width = Math.max(width, r.length); });
  return this.getRange(1, 1, last, Math.max(width, 1));
};
FakeSheet.prototype.appendRow = function (arr) {
  var rows = this._rows(), last = this.getLastRow();
  rows.splice(last, rows.length - last);
  rows.push(arr.slice());
  return this;
};
FakeSheet.prototype.deleteRow = function (r) { this._rows().splice(r - 1, 1); return this; };

var SpreadsheetApp = {
  getActive: function () {
    return {
      getSheetByName: function (n) { return __tabs[n] ? new FakeSheet(n) : null; },
      insertSheet: function (n) { __tabs[n] = []; return new FakeSheet(n); }
    };
  }
};

var LockService = { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } };

var Utilities = {
  formatDate: function (d, tz, fmt) {
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
};
