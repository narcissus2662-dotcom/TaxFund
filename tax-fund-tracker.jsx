import React, { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Plus, Trash2, Target, Check, RotateCcw, X, Upload, Copy, Check as CheckIcon } from "lucide-react";

const STORAGE_KEY = "taxfund:data";
const THIS_YEAR = new Date().getFullYear() + 543; // พ.ศ.

const PRESET_FUNDS = ["RMF", "SSF", "Thai ESG", "Thai ESGX"];

// palette: deep teal + warm gold, segments cycle through these
const SEG_COLORS = ["#1E6B5E", "#2E9E86", "#C9A227", "#E0B84C", "#4FB6A0", "#8C7A1E"];
const REMAIN_COLOR = "#E4E9E6";

const fmt = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(Math.round(n || 0));

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function TaxFundTracker() {
  const [loaded, setLoaded] = useState(false);
  const [target, setTarget] = useState(0);
  const [purchases, setPurchases] = useState([]);
  const [customFunds, setCustomFunds] = useState([]);

  // form state
  const [date, setDate] = useState(todayISO());
  const [fund, setFund] = useState("RMF");
  const [amount, setAmount] = useState("");
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [showExport, setShowExport] = useState(false);
  const [copied, setCopied] = useState(false);

  // load once
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY);
        if (res && res.value) {
          const data = JSON.parse(res.value);
          setTarget(data.target || 0);
          const loadedPurchases = Array.isArray(data.purchases) ? data.purchases : [];
          setPurchases(loadedPurchases);
          // chip กองทุนที่พิมพ์เอง + กองที่เคยบันทึกไว้แต่ยังไม่ใช่ preset
          const stored = Array.isArray(data.customFunds) ? data.customFunds : [];
          const fromPurchases = loadedPurchases
            .map((p) => p.fund)
            .filter((f) => f && !PRESET_FUNDS.includes(f));
          setCustomFunds([...new Set([...stored, ...fromPurchases])]);
        }
      } catch (e) {
        // ยังไม่มีข้อมูล หรือ storage ใช้ไม่ได้ — เริ่มจากว่าง
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // save on change (after initial load)
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await window.storage.set(
          STORAGE_KEY,
          JSON.stringify({ target, purchases, customFunds })
        );
      } catch (e) {
        console.error("บันทึกไม่สำเร็จ", e);
      }
    })();
  }, [target, purchases, customFunds, loaded]);

  const totalBought = useMemo(
    () => purchases.reduce((s, p) => s + (p.amount || 0), 0),
    [purchases]
  );
  const remaining = Math.max(target - totalBought, 0);
  const pct = target > 0 ? Math.min((totalBought / target) * 100, 100) : 0;
  const reached = target > 0 && totalBought >= target;

  // ทยอยซื้อยอดที่เหลือ ทุกสัปดาห์ ถึง 30 พ.ย. ของปีนี้
  const deadline = new Date(new Date().getFullYear(), 10, 30); // 30 พ.ย.
  const weeksLeft = Math.max(
    0,
    Math.ceil((deadline - new Date()) / (7 * 24 * 3600 * 1000))
  );
  const perWeek = weeksLeft > 0 ? remaining / weeksLeft : 0;

  // รวมยอดตามกองทุนเพื่อทำ segment
  const byFund = useMemo(() => {
    const m = new Map();
    for (const p of purchases) m.set(p.fund, (m.get(p.fund) || 0) + p.amount);
    return Array.from(m, ([name, value]) => ({ name, value })).sort(
      (a, b) => b.value - a.value
    );
  }, [purchases]);

  const chartData = useMemo(() => {
    const segs = byFund.map((f, i) => ({
      ...f,
      color: SEG_COLORS[i % SEG_COLORS.length],
    }));
    if (remaining > 0 || segs.length === 0) {
      segs.push({ name: "เหลือ", value: remaining || (target === 0 ? 1 : 0), color: REMAIN_COLOR });
    }
    return segs;
  }, [byFund, remaining, target]);

  const addPurchase = () => {
    const amt = parseFloat(String(amount).replace(/,/g, ""));
    if (!amt || amt <= 0) return;
    const name = fund.trim() || "อื่นๆ";
    setPurchases((prev) => [
      { id: Date.now(), date, fund: name, amount: amt },
      ...prev,
    ]);
    if (!PRESET_FUNDS.includes(name) && !customFunds.includes(name)) {
      setCustomFunds((prev) => [...prev, name]);
    }
    setAmount("");
  };

  const removeCustomFund = (name) =>
    setCustomFunds((prev) => prev.filter((f) => f !== name));

  const removePurchase = (id) =>
    setPurchases((prev) => prev.filter((p) => p.id !== id));

  const saveTarget = () => {
    const t = parseFloat(String(targetInput).replace(/,/g, ""));
    setTarget(!t || t < 0 ? 0 : t);
    setEditingTarget(false);
  };

  const resetAll = () => {
    if (window.confirm("ล้างข้อมูลทั้งหมด? กู้คืนไม่ได้นะ")) {
      setTarget(0);
      setPurchases([]);
      setCustomFunds([]);
    }
  };

  return (
    <div className="tf-root">
      <style>{styles}</style>

      <header className="tf-header">
        <div>
          <div className="tf-eyebrow">กองทุนลดหย่อนภาษี</div>
          <h1>แผนการซื้อ ปี {THIS_YEAR}</h1>
        </div>
        <div className="tf-hdr-btns">
          {(target > 0 || purchases.length > 0) && (
            <button
              className="tf-reset"
              onClick={() => { setCopied(false); setShowExport(true); }}
              aria-label="ส่งออกข้อมูล"
              title="ส่งออกข้อมูล"
            >
              <Upload size={15} />
            </button>
          )}
          {(target > 0 || purchases.length > 0) && (
            <button className="tf-reset" onClick={resetAll} aria-label="ล้างข้อมูล">
              <RotateCcw size={15} />
            </button>
          )}
        </div>
      </header>

      {showExport && (
        <div className="tf-modal-backdrop" onClick={() => setShowExport(false)}>
          <div className="tf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tf-modal-title">ส่งออกข้อมูล</div>
            <div className="tf-modal-sub">
              คัดลอกโค้ดนี้ แล้วนำไปวางในช่อง "นำเข้าข้อมูล" ของเว็บที่ deploy ไว้
            </div>
            <textarea
              className="tf-modal-textarea"
              readOnly
              value={JSON.stringify({ target, purchases, customFunds })}
              onFocus={(e) => e.target.select()}
            />
            <div className="tf-modal-actions">
              <button
                className="tf-modal-copy"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      JSON.stringify({ target, purchases, customFunds })
                    );
                    setCopied(true);
                  } catch (e) {}
                }}
              >
                {copied ? <CheckIcon size={16} /> : <Copy size={16} />}
                {copied ? "คัดลอกแล้ว" : "คัดลอก"}
              </button>
              <button className="tf-modal-close" onClick={() => setShowExport(false)}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* เป้าหมาย */}
      <div className="tf-target">
        <div className="tf-target-label">
          <Target size={15} /> เป้าหมายทั้งปี
        </div>
        {editingTarget ? (
          <div className="tf-target-edit">
            <span className="tf-baht">฿</span>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              placeholder="เช่น 300000"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveTarget()}
            />
            <button className="tf-mini-btn" onClick={saveTarget}>
              <Check size={16} />
            </button>
          </div>
        ) : (
          <button
            className="tf-target-value"
            onClick={() => {
              setTargetInput(target ? String(target) : "");
              setEditingTarget(true);
            }}
          >
            {target > 0 ? `฿${fmt(target)}` : "แตะเพื่อตั้งเป้า"}
          </button>
        )}
      </div>

      {/* วงกลมความคืบหน้า */}
      <div className="tf-chart-card">
        <div className="tf-chart-wrap">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                innerRadius={78}
                outerRadius={108}
                startAngle={90}
                endAngle={-270}
                stroke="none"
                paddingAngle={chartData.length > 1 ? 1.5 : 0}
              >
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="tf-center">
            <div className={`tf-pct ${reached ? "done" : ""}`}>
              {target > 0 ? `${pct.toFixed(0)}%` : "—"}
            </div>
            <div className="tf-center-sub">ของเป้าหมาย</div>
          </div>
        </div>

        <div className="tf-stats">
          <div>
            <div className="tf-stat-num">฿{fmt(totalBought)}</div>
            <div className="tf-stat-lbl">ซื้อแล้ว</div>
          </div>
          <div className="tf-divider" />
          <div>
            <div className="tf-stat-num muted">฿{fmt(remaining)}</div>
            <div className="tf-stat-lbl">เหลืออีก</div>
          </div>
        </div>

        {byFund.length > 0 && (
          <div className="tf-legend">
            {byFund.map((f, i) => (
              <div className="tf-legend-item" key={f.name}>
                <span
                  className="tf-dot"
                  style={{ background: SEG_COLORS[i % SEG_COLORS.length] }}
                />
                {f.name} · ฿{fmt(f.value)}
              </div>
            ))}
          </div>
        )}
        {reached && <div className="tf-reached">🎉 ถึงเป้าแล้ว!</div>}
      </div>

      {/* ทยอยซื้อรายสัปดาห์ */}
      {target > 0 && remaining > 0 && (
        <div className="tf-pace">
          {weeksLeft > 0 ? (
            <>
              <div className="tf-pace-top">
                <span className="tf-pace-lbl">ทยอยซื้อทุกสัปดาห์ ถึง 30 พ.ย.</span>
                <span className="tf-pace-weeks">เหลือ {weeksLeft} สัปดาห์</span>
              </div>
              <div className="tf-pace-num">
                ฿{fmt(perWeek)}
                <span>/สัปดาห์</span>
              </div>
              <div className="tf-pace-sub">รวมยอดที่ยังต้องซื้อ ฿{fmt(remaining)}</div>
            </>
          ) : (
            <div className="tf-pace-sub tf-center-txt">
              เลยกำหนด 30 พ.ย. ของปีนี้แล้ว
            </div>
          )}
        </div>
      )}

      {/* ฟอร์มเพิ่มรายการ */}
      <div className="tf-form">
        <div className="tf-form-title">บันทึกการซื้อ</div>
        <div className="tf-chips">
          {PRESET_FUNDS.map((f) => (
            <button
              key={f}
              className={`tf-chip ${fund === f ? "active" : ""}`}
              onClick={() => setFund(f)}
            >
              {f}
            </button>
          ))}
          {customFunds.map((f) => (
            <span
              key={f}
              className={`tf-chip tf-chip-custom ${fund === f ? "active" : ""}`}
            >
              <button className="tf-chip-label" onClick={() => setFund(f)}>
                {f}
              </button>
              <button
                className="tf-chip-x"
                onClick={() => removeCustomFund(f)}
                aria-label={`ลบ ${f}`}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
        <div className="tf-row">
          <input
            className="tf-fund-input"
            type="text"
            value={fund}
            onChange={(e) => setFund(e.target.value)}
            placeholder="ชื่อกองทุน"
          />
          <input
            className="tf-date-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="tf-row">
          <div className="tf-amount">
            <span className="tf-baht">฿</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="จำนวนเงิน"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPurchase()}
            />
          </div>
          <button className="tf-add" onClick={addPurchase}>
            <Plus size={18} /> เพิ่ม
          </button>
        </div>
      </div>

      {/* รายการ */}
      {purchases.length > 0 && (
        <div className="tf-list">
          {purchases.map((p) => (
            <div className="tf-item" key={p.id}>
              <div className="tf-item-main">
                <span className="tf-item-fund">{p.fund}</span>
                <span className="tf-item-date">
                  {new Date(p.date).toLocaleDateString("th-TH", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
              <div className="tf-item-right">
                <span className="tf-item-amt">฿{fmt(p.amount)}</span>
                <button
                  className="tf-del"
                  onClick={() => removePurchase(p.id)}
                  aria-label="ลบ"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {loaded && purchases.length === 0 && (
        <div className="tf-empty">ยังไม่มีรายการ — เริ่มบันทึกการซื้อครั้งแรกได้เลย</div>
      )}
    </div>
  );
}

const styles = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap');

.tf-root {
  --ink:#10302E; --teal:#1E6B5E; --gold:#C9A227;
  --paper:#F3F6F4; --card:#FFFFFF; --muted:#6B7D78; --line:#E4E9E6;
  font-family:'IBM Plex Sans Thai', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  max-width:440px; margin:0 auto; padding:20px 16px 40px;
  background:var(--paper); min-height:100vh; color:var(--ink);
  box-sizing:border-box;
}
.tf-root *{box-sizing:border-box;}
.tf-header{display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px;}
.tf-hdr-btns{display:flex; gap:8px;}
.tf-modal-backdrop{position:fixed; inset:0; background:rgba(16,48,46,.45); display:flex; align-items:center; justify-content:center; padding:20px; z-index:50;}
.tf-modal{background:#fff; border-radius:20px; padding:20px; max-width:400px; width:100%;}
.tf-modal-title{font-weight:700; font-size:17px; margin-bottom:4px;}
.tf-modal-sub{font-size:13px; color:var(--muted); margin-bottom:12px; line-height:1.5;}
.tf-modal-textarea{width:100%; height:90px; border:1px solid var(--line); border-radius:10px; padding:10px; font-size:11px; font-family:monospace; color:var(--ink); resize:none; background:var(--paper);}
.tf-modal-actions{display:flex; gap:8px; margin-top:12px;}
.tf-modal-copy{flex:1; display:flex; align-items:center; justify-content:center; gap:6px; background:var(--teal); color:#fff; border:none; border-radius:10px; padding:10px; font-size:14px; font-weight:600; font-family:inherit; cursor:pointer;}
.tf-modal-close{background:var(--paper); border:1px solid var(--line); border-radius:10px; padding:10px 16px; font-size:14px; font-weight:600; font-family:inherit; cursor:pointer; color:var(--ink);}
.tf-eyebrow{font-size:12px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--teal); margin-bottom:2px;}
.tf-header h1{font-size:22px; font-weight:700; margin:0; line-height:1.2;}
.tf-reset{background:none; border:1px solid var(--line); border-radius:10px; width:34px; height:34px; display:grid; place-items:center; color:var(--muted); cursor:pointer;}
.tf-reset:active{background:var(--line);}

.tf-target{background:var(--ink); border-radius:16px; padding:14px 18px; display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;}
.tf-target-label{display:flex; align-items:center; gap:6px; color:#B8CCC7; font-size:13px; font-weight:500;}
.tf-target-value{background:none; border:none; color:#fff; font-size:20px; font-weight:700; cursor:pointer; font-family:inherit;}
.tf-target-edit{display:flex; align-items:center; gap:4px;}
.tf-target-edit input{width:120px; background:rgba(255,255,255,.12); border:none; border-radius:8px; padding:6px 8px; color:#fff; font-size:17px; font-weight:600; font-family:inherit;}
.tf-target-edit input::placeholder{color:#7d938e;}
.tf-baht{color:#B8CCC7; font-weight:600;}
.tf-mini-btn{background:var(--gold); border:none; border-radius:8px; width:32px; height:32px; display:grid; place-items:center; color:var(--ink); cursor:pointer;}

.tf-chart-card{background:var(--card); border-radius:20px; padding:18px 18px 20px; margin-bottom:14px; box-shadow:0 1px 3px rgba(16,48,46,.05);}
.tf-chart-wrap{position:relative;}
.tf-center{position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none;}
.tf-pct{font-size:44px; font-weight:700; line-height:1; letter-spacing:-.02em;}
.tf-pct.done{color:var(--gold);}
.tf-center-sub{font-size:13px; color:var(--muted); margin-top:4px;}

.tf-stats{display:flex; align-items:center; justify-content:center; gap:20px; margin-top:6px;}
.tf-stat-num{font-size:19px; font-weight:700; text-align:center;}
.tf-stat-num.muted{color:var(--muted);}
.tf-stat-lbl{font-size:12px; color:var(--muted); text-align:center; margin-top:1px;}
.tf-divider{width:1px; height:32px; background:var(--line);}

.tf-legend{display:flex; flex-wrap:wrap; gap:8px 14px; justify-content:center; margin-top:16px; padding-top:14px; border-top:1px solid var(--line);}
.tf-legend-item{display:flex; align-items:center; gap:6px; font-size:13px; color:var(--ink);}
.tf-dot{width:9px; height:9px; border-radius:50%; display:inline-block;}
.tf-reached{text-align:center; margin-top:14px; font-weight:600; color:var(--gold);}

.tf-pace{background:linear-gradient(135deg,#1E6B5E,#10302E); border-radius:20px; padding:18px 20px; margin-bottom:14px; color:#fff;}
.tf-pace-top{display:flex; justify-content:space-between; align-items:center; gap:8px;}
.tf-pace-lbl{font-size:13px; color:#C7DAD5; font-weight:500;}
.tf-pace-weeks{font-size:12px; background:rgba(255,255,255,.14); padding:3px 10px; border-radius:20px; white-space:nowrap;}
.tf-pace-num{font-size:34px; font-weight:700; margin-top:10px; letter-spacing:-.02em; color:#E7C15A;}
.tf-pace-num span{font-size:15px; font-weight:500; color:#C7DAD5; margin-left:4px;}
.tf-pace-sub{font-size:13px; color:#A9C2BC; margin-top:3px;}
.tf-center-txt{text-align:center;}

.tf-form{background:var(--card); border-radius:20px; padding:16px 16px 18px; margin-bottom:14px; box-shadow:0 1px 3px rgba(16,48,46,.05);}
.tf-form-title{font-weight:600; font-size:15px; margin-bottom:12px;}
.tf-chips{display:flex; flex-wrap:wrap; gap:7px; margin-bottom:12px;}
.tf-chip{background:var(--paper); border:1px solid var(--line); border-radius:20px; padding:6px 13px; font-size:13px; font-weight:500; cursor:pointer; color:var(--ink); font-family:inherit;}
.tf-chip.active{background:var(--teal); border-color:var(--teal); color:#fff;}
.tf-chip-custom{display:inline-flex; align-items:center; gap:0; padding:0; overflow:hidden;}
.tf-chip-label{background:none; border:none; padding:6px 4px 6px 13px; font-size:13px; font-weight:500; color:inherit; cursor:pointer; font-family:inherit;}
.tf-chip-x{background:none; border:none; padding:6px 9px 6px 5px; display:grid; place-items:center; cursor:pointer; color:inherit; opacity:.55;}
.tf-chip-x:active{opacity:1;}
.tf-chip-custom.active .tf-chip-x{opacity:.8;}
.tf-row{display:flex; gap:8px; margin-bottom:8px;}
.tf-row:last-child{margin-bottom:0;}
.tf-fund-input{flex:1; border:1px solid var(--line); border-radius:11px; padding:11px 12px; font-size:15px; font-family:inherit; color:var(--ink); min-width:0;}
.tf-date-input{border:1px solid var(--line); border-radius:11px; padding:11px 10px; font-size:14px; font-family:inherit; color:var(--ink); background:#fff;}
.tf-amount{flex:1; display:flex; align-items:center; gap:6px; border:1px solid var(--line); border-radius:11px; padding:0 12px; min-width:0;}
.tf-amount input{flex:1; border:none; padding:11px 0; font-size:16px; font-weight:600; font-family:inherit; color:var(--ink); min-width:0; background:none;}
.tf-add{background:var(--ink); color:#fff; border:none; border-radius:11px; padding:0 18px; font-size:15px; font-weight:600; display:flex; align-items:center; gap:5px; cursor:pointer; font-family:inherit; white-space:nowrap;}
.tf-add:active{background:var(--teal);}
input:focus{outline:none; border-color:var(--teal);}
.tf-amount:focus-within, .tf-target-edit input:focus{outline:none;}

.tf-list{display:flex; flex-direction:column; gap:8px;}
.tf-item{background:var(--card); border-radius:13px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 1px 2px rgba(16,48,46,.04);}
.tf-item-main{display:flex; flex-direction:column; gap:2px;}
.tf-item-fund{font-weight:600; font-size:15px;}
.tf-item-date{font-size:12px; color:var(--muted);}
.tf-item-right{display:flex; align-items:center; gap:10px;}
.tf-item-amt{font-weight:700; font-size:15px;}
.tf-del{background:none; border:none; color:#C4726A; cursor:pointer; padding:4px; display:grid; place-items:center;}
.tf-del:active{color:#a3564f;}
.tf-empty{text-align:center; color:var(--muted); font-size:14px; padding:20px 10px;}

@media (prefers-reduced-motion: reduce){ *{transition:none !important; animation:none !important;} }
`;
