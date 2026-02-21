document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const baseEl = $("base");
  const stepEl = $("step");
  const maxEl  = $("max");
  const decEl  = $("decimals");

  const errEl = $("err");
  const bodyEl = $("tbody");
  const statusEl = $("status");

  const btnSPY = $("btnSPY");
  const btnQQQ = $("btnQQQ");
  const btnIWM = $("btnIWM");

  const calcBtn = $("calc");
  const autoBtn = $("auto");
  const focusBtn = $("focus");
  const clearBtn = $("clear");
  const btnW1 = $("btnW1");

  const chgBadge = $("chgBadge");
  const chgTf = $("chgTf");
  const chgArrow = $("chgArrow");
  const chgVal = $("chgVal");

  const weekListEl = document.getElementById("weekList");
  const weekSubEl  = document.getElementById("weekSub");    

  let autoCalc = true;
  let focusMode = true;
  let activeSymbol = null;
  let usePriorWeekClose = false;

  const API_KEY = "03263123023e425fbe5ec22a54a12363";
  const etfButtons = [btnSPY, btnQQQ, btnIWM];

  function parseNum(v){
    if (typeof v !== "string") return NaN;
    v = v.trim().replace(",", ".");
    return v === "" ? NaN : Number(v);
  }

  function clampDecimals(v){
    const n = Math.floor(parseNum(v));
    if (!Number.isFinite(n)) return 2;
    return Math.max(0, Math.min(10, n));
  }

  function fmt(n, decimals){
    return Number.isFinite(n) ? n.toFixed(decimals) : "";
  }

  function showError(msg){
    errEl.textContent = msg;
    errEl.style.display = "block";
  }

  function clearError(){
    errEl.textContent = "";
    errEl.style.display = "none";
  }

  function clearSelection(){
    bodyEl.classList.remove("has-active");
    bodyEl.querySelectorAll("tr.is-active").forEach(tr => tr.classList.remove("is-active"));
  }

  function applyFocusClass(){
    const hasActive = !!bodyEl.querySelector("tr.is-active");
    bodyEl.classList.toggle("has-active", focusMode && hasActive);
  }

  function buildTable(){
    const base = parseNum(baseEl.value);
    const step = parseNum(stepEl.value);
    const max  = parseNum(maxEl.value);
    const decimals = clampDecimals(decEl.value);

    if (!Number.isFinite(base)) return showError("Enter a valid base value (e.g., 685).");
    if (!Number.isFinite(step) || step <= 0) return showError("Step must be a positive number (e.g., 0.5).");
    if (!Number.isFinite(max)  || max  <= 0) return showError("Max (%) must be a positive number (e.g., 5).");
    if (step > max) return showError("Step (%) cannot be greater than Max (%).");

    clearError();

    const count = Math.floor((max + 1e-12) / step);
    bodyEl.innerHTML = "";

    for (let i = 1; i <= count; i++){
      const p = i * step;
      const plusVal  = base * (1 + p/100);
      const minusVal = base * (1 - p/100);

      const tr = document.createElement("tr");
      const pStr = (Math.round(p * 100) / 100)
        .toString()
        .replace(/\.0+$/,"")
        .replace(/(\.\d)0$/,"$1");

      tr.innerHTML = `
        <td class="colP pct">${pStr}%</td>
        <td class="colMinus neg">${fmt(minusVal, decimals)}</td>
        <td class="colPlus pos">${fmt(plusVal, decimals)}</td>
      `;

      tr.addEventListener("click", () => {
        const isActive = tr.classList.contains("is-active");
        clearSelection();
        if (!isActive) tr.classList.add("is-active");
        applyFocusClass();
      });

      bodyEl.appendChild(tr);
    }

    applyFocusClass();
  }

  function maybeAuto(){
    if (autoCalc) buildTable();
  }

  function setChangeBadge({ tf, pct }) {
    if (!Number.isFinite(pct)) {
      chgBadge.classList.add("is-hidden");
      chgBadge.classList.remove("is-pos","is-neg");
      return;
    }

    const sign = pct >= 0 ? "+" : "";
    chgTf.textContent = tf;
    chgVal.textContent = `${sign}${pct.toFixed(2)}%`;

    chgBadge.classList.remove("is-pos","is-neg","is-hidden");
    if (pct >= 0) {
      chgBadge.classList.add("is-pos");
      chgArrow.textContent = "▲";
    } else {
      chgBadge.classList.add("is-neg");
      chgArrow.textContent = "▼";
    }
  }

  function setActiveEtfButton(activeBtn){
    etfButtons.forEach(b => b.classList.remove("primary"));
    activeBtn.classList.add("primary");
  }

  async function fetchQuote(symbol){
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${API_KEY}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Quote fetch failed");
    const data = await res.json();
    if (data.status === "error") throw new Error(data.message || "API error");

    const last = Number(data.close ?? data.price);
    const prevClose = Number(data.previous_close);
    const dayPct = Number(data.percent_change);

    if (!Number.isFinite(last)) throw new Error("No last price");
    return { last, prevClose, dayPct };
  }

  async function fetchPriorWeekClose(symbol){
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1week&outputsize=5&apikey=${API_KEY}`;
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    if (data.status === "error") throw new Error(data.message || "API error");

    const values = data.values;
    if (!Array.isArray(values) || values.length < 2) throw new Error("Not enough weekly data");

    const close = Number(values[1].close); // prior completed week close
    if (!Number.isFinite(close)) throw new Error("Bad close");

    return close;
  }

  function isoWeekKey(d = new Date()){
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`;
  }

  async function getPriorWeekCloseCached(symbol){
    const key = `w1close_${symbol}`;
    const wk = isoWeekKey(new Date());
    const cached = localStorage.getItem(key);

    if (cached){
      try{
        const obj = JSON.parse(cached);
        if (obj && obj.weekKey === wk && Number.isFinite(obj.close)) return obj.close;
      }catch{}
    }

    const close = await fetchPriorWeekClose(symbol);
    localStorage.setItem(key, JSON.stringify({ weekKey: wk, close }));
    return close;
  }

  async function setBaseFromSymbol(symbol, btn){
    const old = btn.textContent;

    btn.disabled = true;
    btn.textContent = symbol + "…";

    activeSymbol = symbol;
    setActiveEtfButton(btn);
    // weekly panel (cached; 1 call/week per symbol)
    weekSubEl.textContent = `Loading ${symbol}…`;
    getWeeklySeriesCached(symbol)
      .then(values => renderWeeklyList(symbol, buildWeeklyRows(values)))
      .catch(() => { weekSubEl.textContent = "Weekly data unavailable"; weekListEl.innerHTML = ""; });

    try{
      statusEl.textContent = "Fetching " + symbol;

      const q = await fetchQuote(symbol);

      let px;
      if (usePriorWeekClose){
        const w1 = await getPriorWeekCloseCached(symbol);
        px = w1;

        const pct = ((q.last / w1) - 1) * 100;
        setChangeBadge({ tf: "1W", pct });
      } else {
        px = q.last;

        const dayPct = Number.isFinite(q.dayPct)
          ? q.dayPct
          : (Number.isFinite(q.prevClose) ? ((q.last / q.prevClose) - 1) * 100 : NaN);

        setChangeBadge({ tf: "1D", pct: dayPct });
      }

      baseEl.value = px.toFixed(2);
      maybeAuto();

      statusEl.textContent = usePriorWeekClose ? `${symbol} Last week` : `${symbol} live price`;
      setTimeout(() => { statusEl.textContent = "Ready"; }, 1200);

    } catch (e){
      showError(`Could not fetch ${symbol} price (some previews block external fetch).`);
      statusEl.textContent = "Ready";
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  }

  async function fetchWeeklySeries(symbol){
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1week&outputsize=60&apikey=${API_KEY}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (data.status === "error") throw new Error(data.message || "API error");
  if (!Array.isArray(data.values) || data.values.length < 2) throw new Error("Not enough weekly data");
  return data.values; // newest-first
}

async function getWeeklySeriesCached(symbol){
  const key = `w52_${symbol}`;
  const wk = isoWeekKey(new Date());
  const cached = localStorage.getItem(key);
  if (cached){
    try{
      const obj = JSON.parse(cached);
      if (obj && obj.weekKey === wk && Array.isArray(obj.values) && obj.values.length >= 2) return obj.values;
    }catch{}
  }
  const values = await fetchWeeklySeries(symbol);
  localStorage.setItem(key, JSON.stringify({ weekKey: wk, values }));
  return values;
}

function buildWeeklyRows(values){
  const rows = [];
  const n = Math.min(values.length - 1, 52);
  for (let i = 0; i < n; i++){
    const cur = Number(values[i].close);
    const prev = Number(values[i+1].close);
    if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) continue;
    const pct = ((cur / prev) - 1) * 100;
    rows.push({ datetime: values[i].datetime, close: cur, pct });
  }
  return rows;
}

let activeWeekIndex = null;

function renderWeeklyList(symbol, rows){
  weekSubEl.textContent = symbol ? `${symbol} • click a week to set Price` : "Select an ETF";
  weekListEl.innerHTML = "";

  rows.forEach((r, idx) => {
    const item = document.createElement("div");
    item.className = "weekItem" + (idx === activeWeekIndex ? " is-active" : "");

    const pctClass = r.pct >= 0 ? "pos" : "neg";
    const sign = r.pct >= 0 ? "+" : "";

    item.innerHTML = `
      <div class="weekLeft">
        <div class="weekDate">${r.datetime}</div>
        <div class="weekClose">Close: ${r.close.toFixed(2)}</div>
      </div>
      <div class="weekPct ${pctClass}">${sign}${r.pct.toFixed(2)}%</div>
    `;

    item.addEventListener("click", () => {
      // highlight active
      activeWeekIndex = idx;
      weekListEl.querySelectorAll(".weekItem").forEach(el => el.classList.remove("is-active"));
      item.classList.add("is-active");

      // set base to that week close (no extra API calls)
      baseEl.value = r.close.toFixed(2);
      maybeAuto();

      statusEl.textContent = "Weekly close set";
      setTimeout(() => { statusEl.textContent = "Ready"; }, 900);
    });
    weekSubEl.textContent = `${symbol} • ${rows.length} weeks loaded`;
    weekListEl.appendChild(item);
  });
}

  function updateW1UI(){
    btnW1.textContent = usePriorWeekClose ? "1w: ON" : "1w: OFF";
    btnW1.classList.toggle("primary", usePriorWeekClose);
  }

  // Events
  btnSPY.addEventListener("click", () => setBaseFromSymbol("SPY", btnSPY));
  btnQQQ.addEventListener("click", () => setBaseFromSymbol("QQQ", btnQQQ));
  btnIWM.addEventListener("click", () => setBaseFromSymbol("IWM", btnIWM));

  baseEl.addEventListener("input", () => {
    etfButtons.forEach(b => b.classList.remove("primary"));
    setChangeBadge({ tf: "—", pct: NaN });
    activeSymbol = null;
  });

  btnW1.addEventListener("click", () => {
    usePriorWeekClose = !usePriorWeekClose;
    updateW1UI();
  });
  updateW1UI();

  calcBtn.addEventListener("click", buildTable);

  autoBtn.addEventListener("click", () => {
    autoCalc = !autoCalc;
    autoBtn.textContent = `Auto: ${autoCalc ? "ON" : "OFF"}`;
    if (autoCalc) buildTable();
  });

  focusBtn.addEventListener("click", () => {
    focusMode = !focusMode;
    focusBtn.textContent = `Focus: ${focusMode ? "ON" : "OFF"}`;
    applyFocusClass();
  });

  clearBtn.addEventListener("click", clearSelection);

  [baseEl, stepEl, maxEl, decEl].forEach(el => {
    el.addEventListener("input", maybeAuto);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") buildTable(); });
  });

  // Init
  buildTable();
  setBaseFromSymbol("SPY", btnSPY);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js");
  }
});
