/* Net Worth Calculator – client app */

let config = {};
let assets = [];
let summary = null;
let editingId = null;
let activeFilter = "ALL";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── API ───────────────────────────────────────────────────────

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── Formatting ────────────────────────────────────────────────

function fmt(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency,
    maximumFractionDigits: currency === "INR" ? 0 : 2,
  }).format(amount);
}

function fmtDate(d) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.hidden = true), 3500);
}

// ── Render ────────────────────────────────────────────────────

function renderHero() {
  if (!summary) return;
  $("#totalValue").textContent = fmt(summary.totalInr);
  $("#heroMeta").textContent = `${assets.length} assets · Updated ${new Date(summary.lastUpdated).toLocaleString("en-IN")} · Base: INR`;
}

function renderCategories() {
  const el = $("#categories");
  const cats = summary?.categories.filter((c) => c.count > 0) || [];
  if (!cats.length) { el.innerHTML = ""; return; }

  el.innerHTML = cats.map((c) => {
    const pct = summary.totalInr > 0 ? (c.totalInr / summary.totalInr) * 100 : 0;
    return `
      <div class="cat-card cat-${c.category}">
        <div class="cat-header">
          <div>
            <span class="cat-dot dot-${c.category}"></span>
            <span class="cat-name">${c.label}</span>
            <div class="cat-count">${c.count} asset${c.count !== 1 ? "s" : ""}</div>
          </div>
          <div>
            <div class="cat-value">${fmt(c.totalInr)}</div>
            <div class="cat-pct">${pct.toFixed(1)}%</div>
          </div>
        </div>
        <div class="cat-bar"><div class="cat-bar-fill bar-${c.category}" style="width:${Math.min(pct, 100)}%"></div></div>
      </div>`;
  }).join("");
}

function assetDetail(a) {
  const cfg = config;
  switch (a.category) {
    case "EQUITY_INDIAN":
    case "EQUITY_FOREIGN":
      return `${a.symbol}${a.exchange ? " · " + (cfg.exchangeLabels[a.exchange] || a.exchange) : ""} · ${a.quantity} shares @ ${fmt(a.currentPrice ?? a.purchasePrice ?? 0, a.currency)}${(a.fees ?? 0) > 0 ? " · Fees: " + fmt(a.fees, a.currency) : ""}${a.lastRevaluedAt ? " · Revalued " + fmtDate(a.lastRevaluedAt) : ""}`;
    case "PF":
      return `Principal ${fmt(a.principal ?? 0, a.currency)} · ${a.interestRate}% p.a.${a.monthlyContribution ? " · " + fmt(a.monthlyContribution, a.currency) + "/mo" : ""}${a.startDate ? " · Since " + fmtDate(a.startDate) : ""}`;
    case "BANK_ACCOUNT":
      return `${a.accountType ? (cfg.bankAccountLabels[a.accountType] || a.accountType) : "Account"}${a.bankName ? " · " + a.bankName : ""}`;
    case "SAVINGS":
      return a.bankName ? `At ${a.bankName}` : "Savings account";
    default:
      return a.notes || "";
  }
}

function renderFilters() {
  const el = $("#filters");
  const cats = Object.entries(config.categoryLabels || {});
  el.innerHTML = `<button class="filter-chip${activeFilter === "ALL" ? " active" : ""}" data-filter="ALL">All</button>` +
    cats.map(([k, v]) => {
      const count = assets.filter((a) => a.category === k).length;
      if (!count) return "";
      return `<button class="filter-chip${activeFilter === k ? " active" : ""}" data-filter="${k}">${v} <span style="opacity:.6">${count}</span></button>`;
    }).join("");

  el.querySelectorAll(".filter-chip").forEach((btn) => {
    btn.onclick = () => { activeFilter = btn.dataset.filter; renderFilters(); renderAssets(); };
  });
}

function renderAssets() {
  const el = $("#assetList");
  const filtered = activeFilter === "ALL" ? assets : assets.filter((a) => a.category === activeFilter);

  if (!assets.length) {
    el.innerHTML = `<div class="empty-state"><p>No assets yet</p><p style="margin-top:6px">Add your first asset to start tracking.</p></div>`;
    return;
  }

  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state"><p>No assets in this category</p></div>`;
    return;
  }

  const isEquity = (a) => a.category === "EQUITY_INDIAN" || a.category === "EQUITY_FOREIGN";

  el.innerHTML = `<table class="asset-table">
    <thead><tr>
      <th>Asset</th><th class="col-cat">Category</th>
      <th style="text-align:right">Value</th><th style="text-align:right">Actions</th>
    </tr></thead>
    <tbody>${filtered.map((a) => `
      <tr>
        <td><div class="asset-name">${esc(a.name)}</div><div class="asset-detail">${esc(assetDetail(a))}</div></td>
        <td class="col-cat"><span class="badge badge-${a.category}">${config.categoryLabels[a.category] || a.category}</span></td>
        <td class="asset-value">${fmt(a.computedValue ?? a.value, a.currency)}${a.currency !== "INR" ? `<div class="asset-detail">${a.currency}</div>` : ""}</td>
        <td class="asset-actions">
          ${isEquity(a) ? `<button class="btn-sm" onclick="revalueOne('${a.id}')" title="Revalue">↻</button> ` : ""}
          <button class="btn-sm" onclick="editAsset('${a.id}')">Edit</button>
          <button class="btn-sm btn-danger" onclick="deleteAsset('${a.id}')">Del</button>
        </td>
      </tr>`).join("")}
    </tbody></table>`;
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}

// ── Modal ─────────────────────────────────────────────────────

function showCategoryFields(cat) {
  const isEquity = cat === "EQUITY_INDIAN" || cat === "EQUITY_FOREIGN";
  const isPf = cat === "PF";
  const isBank = cat === "BANK_ACCOUNT";
  const isSavings = cat === "SAVINGS";
  const isSimple = cat === "CASH" || isSavings || isBank;

  $("#fieldsSimple").hidden = !isSimple;
  $("#fieldsEquity").hidden = !isEquity;
  $("#fieldsPf").hidden = !isPf;
  $("#bankNameField").hidden = !(isBank || isSavings);
  $("#accountTypeField").hidden = !isBank;

  if (isEquity) {
    const curSel = $("#currencySelect");
    if (cat === "EQUITY_INDIAN") curSel.value = "INR";
    else if (cat === "EQUITY_FOREIGN" && curSel.value === "INR") curSel.value = "USD";
    filterExchangeOptions(cat);
  }
  hideSuggestions();
}

function filterExchangeOptions(cat) {
  const exSel = $("#exchangeSelect");
  const indian = ["NSE", "BSE"];
  const foreign = ["NYSE", "NASDAQ", "LSE", "SGX", "OTHER"];
  const allowed = cat === "EQUITY_INDIAN" ? indian : foreign;
  for (const opt of exSel.options) {
    opt.hidden = !allowed.includes(opt.value);
  }
  if (!allowed.includes(exSel.value)) {
    exSel.value = cat === "EQUITY_INDIAN" ? "NSE" : "NASDAQ";
  }
}

function openModal(asset) {
  editingId = asset?.id || null;
  $("#modalTitle").textContent = asset ? "Edit Asset" : "Add Asset";
  $("#btnSave").textContent = asset ? "Update" : "Add Asset";
  const form = $("#assetForm");
  form.reset();

  if (asset) {
    for (const [k, v] of Object.entries(asset)) {
      const input = form.elements[k];
      if (!input) continue;
      if (input.type === "date" && v) input.value = v.slice(0, 10);
      else if (v != null) input.value = v;
    }
    $("#yahooSymbolInput").value = asset.yahooSymbol || "";
  } else {
    $("#yahooSymbolInput").value = "";
  }

  showCategoryFields(form.category.value);
  $("#modal").hidden = false;
}

function closeModal() {
  $("#modal").hidden = true;
  editingId = null;
}

function readForm() {
  const form = $("#assetForm");
  const cat = form.category.value;
  const body = {
    name: form.name.value,
    category: cat,
    currency: form.currency.value,
    notes: form.notes.value || null,
  };

  if (cat === "CASH" || cat === "SAVINGS" || cat === "BANK_ACCOUNT") {
    body.value = parseFloat(form.value.value) || 0;
    if (cat !== "CASH") body.bankName = form.bankName.value || null;
    if (cat === "BANK_ACCOUNT") body.accountType = form.accountType.value || null;
  }
  if (cat === "EQUITY_INDIAN" || cat === "EQUITY_FOREIGN") {
    const rawSymbol = form.symbol.value.toUpperCase().trim();
    body.symbol = rawSymbol.replace(/\.(NS|BO|L|SI|SG)$/i, "");
    body.yahooSymbol = $("#yahooSymbolInput").value || null;
    body.quantity = parseFloat(form.quantity.value) || 0;
    body.purchasePrice = form.purchasePrice.value ? parseFloat(form.purchasePrice.value) : null;
    body.currentPrice = form.currentPrice.value ? parseFloat(form.currentPrice.value) : null;
    body.fees = parseFloat(form.fees.value) || 0;
    body.exchange = form.exchange.value;
    body.value = 0;
  }
  if (cat === "PF") {
    body.principal = parseFloat(form.principal.value) || 0;
    body.interestRate = parseFloat(form.interestRate.value) || 0;
    body.startDate = form.startDate.value || null;
    body.monthlyContribution = form.monthlyContribution.value ? parseFloat(form.monthlyContribution.value) : null;
    body.value = 0;
  }
  return body;
}

// ── Actions ───────────────────────────────────────────────────

async function refresh() {
  [config, assets, summary] = await Promise.all([
    api("/api/config"),
    api("/api/assets"),
    api("/api/summary"),
  ]);

  const hasEquity = assets.some((a) => a.category === "EQUITY_INDIAN" || a.category === "EQUITY_FOREIGN");
  $("#btnRevalue").hidden = !hasEquity;

  renderHero();
  renderCategories();
  renderFilters();
  renderAssets();
}

async function saveAsset(e) {
  e.preventDefault();
  const body = readForm();
  try {
    if (editingId) await api(`/api/assets/${editingId}`, { method: "PUT", body: JSON.stringify(body) });
    else await api("/api/assets", { method: "POST", body: JSON.stringify(body) });
    closeModal();
    await refresh();
    toast(editingId ? "Asset updated" : "Asset added");
  } catch (err) {
    toast(err.message);
  }
}

window.editAsset = async function (id) {
  const asset = assets.find((a) => a.id === id);
  if (asset) openModal(asset);
};

window.deleteAsset = async function (id) {
  if (!confirm("Delete this asset?")) return;
  await api(`/api/assets/${id}`, { method: "DELETE" });
  await refresh();
  toast("Asset deleted");
};

window.revalueOne = async function (id) {
  try {
    const data = await api("/api/revalue", { method: "POST", body: JSON.stringify({ assetIds: [id] }) });
    await refresh();
    const failed = data.results?.filter((r) => !r.success);
    if (failed?.length) {
      toast(`${data.message} — ${failed[0].error}`);
    } else {
      toast(data.message);
    }
  } catch (err) { toast(err.message); }
};

async function revalueAll() {
  $("#btnRevalue").disabled = true;
  try {
    const data = await api("/api/revalue", { method: "POST", body: JSON.stringify({}) });
    await refresh();
    const failed = data.results?.filter((r) => !r.success);
    if (failed?.length) {
      toast(`${data.message}. Failed: ${failed.map((f) => f.symbol + " (" + f.error + ")").join("; ")}`);
    } else {
      toast(data.message);
    }
  } catch (err) { toast(err.message); }
  finally { $("#btnRevalue").disabled = false; }
}

// ── Symbol autocomplete ───────────────────────────────────────

let searchTimer = null;
let activeSuggestion = -1;

function hideSuggestions() {
  const ul = $("#symbolSuggestions");
  ul.hidden = true;
  ul.innerHTML = "";
  activeSuggestion = -1;
}

function getEquityMarket() {
  const cat = $("#categorySelect").value;
  if (cat === "EQUITY_INDIAN") return "indian";
  if (cat === "EQUITY_FOREIGN") return "foreign";
  return "";
}

let lastSearchResults = [];

async function searchSymbols(query) {
  const market = getEquityMarket();
  if (!market || query.length < 1) { hideSuggestions(); return; }

  try {
    const data = await api(`/api/search?q=${encodeURIComponent(query)}&market=${market}`);
    const results = data.results || data; // backward compat
    const hint = data.hint || null;
    lastSearchResults = results;
    const ul = $("#symbolSuggestions");

    if (!results.length) {
      ul.innerHTML = `<li class="no-results">${hint ? esc(hint) : "No matches — try company name (e.g. syrma sgs) or ticker (SYRMA). Use Indian Equity for NSE/BSE stocks."}</li>`;
      ul.hidden = false;
      return;
    }
    ul.innerHTML = results.map((r, i) => `
      <li data-idx="${i}">
        <div class="suggestion-name">${esc(r.name)}</div>
        <div class="suggestion-symbol">Ticker: <strong>${esc(r.symbol)}</strong> · ${esc(r.yahooSymbol)}</div>
        <div class="suggestion-meta">${esc(r.exchangeLabel || r.exchange)} · ${esc(r.currency)}</div>
      </li>`).join("");
    ul.hidden = false;

    ul.querySelectorAll("li[data-idx]").forEach((li) => {
      li.onclick = () => pickSuggestionResult(lastSearchResults[+li.dataset.idx]);
    });
  } catch {
    hideSuggestions();
  }
}

function pickSuggestionResult(r) {
  const form = $("#assetForm");
  form.symbol.value = r.symbol;
  $("#yahooSymbolInput").value = r.yahooSymbol;
  form.exchange.value = r.exchange;
  if (!form.name.value || form.name.value.length < 2) form.name.value = r.name;
  form.currency.value = r.currency;
  hideSuggestions();
}

function setupSymbolAutocomplete() {
  const input = $("#symbolInput");
  const ul = $("#symbolSuggestions");

  input.addEventListener("input", () => {
    $("#yahooSymbolInput").value = "";
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => searchSymbols(input.value.trim()), 280);
  });

  input.addEventListener("focus", () => {
    if (input.value.trim().length >= 1) searchSymbols(input.value.trim());
  });

  input.addEventListener("keydown", (e) => {
    const items = ul.querySelectorAll("li[data-idx]");
    if (!items.length || ul.hidden) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeSuggestion = Math.min(activeSuggestion + 1, items.length - 1);
      items.forEach((li, i) => li.classList.toggle("active", i === activeSuggestion));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeSuggestion = Math.max(activeSuggestion - 1, 0);
      items.forEach((li, i) => li.classList.toggle("active", i === activeSuggestion));
    } else if (e.key === "Enter" && activeSuggestion >= 0) {
      e.preventDefault();
      pickSuggestionResult(lastSearchResults[activeSuggestion]);
    } else if (e.key === "Escape") {
      hideSuggestions();
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-wrap")) hideSuggestions();
  });
}

// ── Init ──────────────────────────────────────────────────────

function populateSelects() {
  const catSel = $("#categorySelect");
  const curSel = $("#currencySelect");
  const accSel = $("#accountTypeSelect");
  const exSel = $("#exchangeSelect");

  catSel.innerHTML = Object.entries(config.categoryLabels).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  curSel.innerHTML = config.currencies.map((c) => `<option value="${c}">${c}</option>`).join("");
  accSel.innerHTML = '<option value="">Select type</option>' +
    Object.entries(config.bankAccountLabels).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  exSel.innerHTML = Object.entries(config.exchangeLabels).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
}

document.addEventListener("DOMContentLoaded", async () => {
  $("#btnAdd").onclick = () => openModal(null);
  $("#btnClose").onclick = closeModal;
  $("#btnCancel").onclick = closeModal;
  $(".modal-backdrop").onclick = closeModal;
  $("#assetForm").onsubmit = saveAsset;
  $("#btnRevalue").onclick = revalueAll;
  $("#categorySelect").onchange = (e) => {
    showCategoryFields(e.target.value);
    $("#symbolInput").value = "";
    $("#yahooSymbolInput").value = "";
    hideSuggestions();
  };

  setupSymbolAutocomplete();

  try {
    config = await api("/api/config");
    populateSelects();
    await refresh();
  } catch (err) {
    toast("Failed to load: " + err.message);
  }
});
