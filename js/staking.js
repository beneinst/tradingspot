/*  ATOM / USDC  Portfolio – Binance - Figment
    Autore: you
    ----------------------------------------------------------- */

const STORAGE_KEY = 'atomPortfolio';
const CACHE_DURATION = 5 * 60 * 1000; // 5 min
let priceCache = null;

let portfolio = {
  symbol: 'ATOM',
  quote : 'USDC',
  entries: []              // { qtyAtom, spentUsdc, priceAtBuy, ts, note }
};

/* ---------- FUNZIONI PREZZO ---------- */
async function fetchAtomPrice() {
  const now = Date.now();
  if (priceCache && (now - priceCache.ts) < CACHE_DURATION) return priceCache.price;

  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ATOMUSDC');
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const price = parseFloat(data.price);
    priceCache = { price, ts: now };
    return price;
  } catch {
    console.warn('Impossibile ottenere prezzo ATOM/USDC');
    return null;
  }
}

/* ---------- FUNZIONI STORAGE ---------- */
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
}
function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) portfolio = { ...portfolio, ...JSON.parse(raw) };
}

/* ---------- CALCOLO STATISTICHE ---------- */
function calcStats() {
  let spentTot = 0, qtyTot = 0;
  portfolio.entries.forEach(e => {
    spentTot += e.spentUsdc;
    qtyTot   += e.qtyAtom;
  });
  const avgPrice = qtyTot > 0 ? spentTot / qtyTot : 0;
  return { spentTot, qtyTot, avgPrice };
}

/* ---------- RENDER (stile Trade) ---------- */
async function render() {
  const cont = document.getElementById('portfolio');
  if (!cont) return;

  const { spentTot, qtyTot, avgPrice } = calcStats();
  const curPrice = await fetchAtomPrice();
  const curVal   = curPrice ? qtyTot * curPrice : 0;
  const pnl      = curVal - spentTot;
  const pnlPct   = spentTot ? (pnl / spentTot) * 100 : 0;
  const pnlClass = pnl >= 0 ? 'positive' : 'negative';

  let rows = '';
  portfolio.entries.forEach((e, i) => {
    const entryVal = curPrice ? (e.qtyAtom * curPrice).toFixed(2) : '-';
    rows += `
      <tr>
        <td>${i + 1}</td>
        <td>${new Date(e.ts).toLocaleDateString('it-IT')}</td>
        <td>${e.qtyAtom.toFixed(6)}</td>
        <td>$${e.spentUsdc.toFixed(2)}</td>
        <td>$${e.priceAtBuy.toFixed(4)}</td>
        <td>$${entryVal}</td>
        <td>${e.note || '-'}</td>
        <td><button onclick="deleteEntry(${i})" class="btn-del">↪</button></td>
      </tr>`;
  });

  cont.innerHTML = `
    <div class="summary-grid">
      <div class="summary-item">
        <div class="label">Investito USDC</div>
        <div class="value">$${spentTot.toFixed(2)}</div>
      </div>
      <div class="summary-item">
        <div class="label">Detenuto ATOM</div>
        <div class="value">${qtyTot.toFixed(6)}</div>
      </div>
      <div class="summary-item">
        <div class="label">Prezzo Medio</div>
        <div class="value">$${avgPrice.toFixed(4)}</div>
      </div>
      ${curPrice ? `
      <div class="summary-item">
        <div class="label">Prezzo Attuale</div>
        <div class="value">$${curPrice.toFixed(4)}</div>
      </div>
      <div class="summary-item">
        <div class="label">Valore Attuale</div>
        <div class="value">$${curVal.toFixed(2)}</div>
      </div>
      <div class="summary-item">
        <div class="label">P&L</div>
        <div class="value ${pnlClass}">$${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)</div>
      </div>` : ''}
    </div>

    <div class="trade-card">
      <div class="trade-title"><br><h3>📋 Riassunto x ritiri in parti</h3></div>
      <div class="trade-content">
        <table class="atom-entry-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Data</th>
              <th>ATOM</th>
              <th>USDC Spesi</th>
              <th>Prezzo Entry</th>
              <th>Valore Attuale</th>
              <th>Nota</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

/* ---------- AGGIUNTA ENTRY ---------- */
function addEntry() {
  const qty   = parseFloat(document.getElementById('qtyAtom').value);
  const spent = parseFloat(document.getElementById('spentUsdc').value);
  const note  = document.getElementById('note').value.trim();

  if (!qty || !spent || qty <= 0 || spent <= 0) {
    alert('Inserisci valori validi!');
    return;
  }

  portfolio.entries.unshift({
    qtyAtom: qty,
    spentUsdc: spent,
    priceAtBuy: spent / qty,
    ts: Date.now(),
    note
  });
  save();
  render();
  document.getElementById('entryForm').reset();
}

/* ---------- CANCELLA ENTRY ---------- */
window.deleteEntry = idx => {
  if (confirm('Eliminare questa entry?')) {
    portfolio.entries.splice(idx, 1);
    save();
    render();
  }
};

/* ---------- INIZIALIZZAZIONE ---------- */
document.addEventListener('DOMContentLoaded', () => {
  load();
  render();
  document.getElementById('entryForm').addEventListener('submit', e => {
    e.preventDefault();
    addEntry();
  });
});

/* ---------- DOWNLOAD REPORT HTML ---------- */
document.getElementById('btnDownload').addEventListener('click', async () => {
  const { spentTot, qtyTot, avgPrice } = calcStats();
  const curPrice = await fetchAtomPrice();
  const curVal   = curPrice ? qtyTot * curPrice : 0;
  const pnl      = curVal - spentTot;
  const pnlPct   = spentTot ? (pnl / spentTot) * 100 : 0;

  let rows = '';
  portfolio.entries.forEach((e, idx) => {
    rows += `
      <tr>
        <td>${idx + 1}</td>
        <td>${new Date(e.ts).toLocaleDateString('it-IT')} ${new Date(e.ts).toLocaleTimeString('it-IT')}</td>
        <td>${e.qtyAtom.toFixed(6)}</td>
        <td>$${e.spentUsdc.toFixed(2)}</td>
        <td>$${e.priceAtBuy.toFixed(4)}</td>
        <td>${e.note || '-'}</td>
      </tr>`;
  });

  const html = `
<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8"/>
  <title>Staking ATOM (Cosmos) – Report</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; background:#f7f9fc; color:#333;}
    h1  { color:#2e7d32; text-align:center; margin-bottom:0;}
    h2  { color:#1976d2; margin-top:30px;}
    .summary { display:flex; gap:30px; flex-wrap:wrap; justify-content:center; margin-bottom:30px;}
    .box { background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,.1); min-width:180px; text-align:center;}
    .label { font-size:.85em; color:#666; margin-bottom:4px;}
    .value { font-size:1.4em; font-weight:600;}
    .positive { color:#26c281;} .negative { color:#ff4d6d;}
    table { width:100%; border-collapse:collapse; margin-top:20px;}
    th,td { padding:10px; border-bottom:1px solid #e0e0e0; text-align:center;}
    th { background:#eeeeee; font-weight:700;}
  </style>
</head>
<body>
  <h1>Staking ATOM (Cosmos)</h1>
  <p style="text-align:center; color:#666;">Report generato il ${new Date().toLocaleString('it-IT')}</p>

  <div class="summary">
    <div class="box">
      <div class="label">Investito USDC</div>
      <div class="value">$${spentTot.toFixed(2)}</div>
    </div>
    <div class="box">
      <div class="label">Detenuto ATOM</div>
      <div class="value">${qtyTot.toFixed(6)}</div>
    </div>
    <div class="box">
      <div class="label">Prezzo Medio</div>
      <div class="value">$${avgPrice.toFixed(4)}</div>
    </div>
    ${curPrice ? `
    <div class="box">
      <div class="label">Prezzo Attuale</div>
      <div class="value">$${curPrice.toFixed(4)}</div>
    </div>
    <div class="box">
      <div class="label">Valore Attuale</div>
      <div class="value">$${curVal.toFixed(2)}</div>
    </div>
    <div class="box">
      <div class="label">P&L</div>
      <div class="value ${pnl >= 0 ? 'positive' : 'negative'}">
        $${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)
      </div>
    </div>` : ''}
  </div>

  <h2>Dettaglio Entry</h2>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Data / Ora</th><th>Quantità ATOM</th><th>USDC Spesi</th><th>Prezzo Entry</th><th>Nota</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <footer style="margin-top:40px; text-align:center; font-size:.8em; color:#888;">
    Dati prezzo da Binance API – Le performance passate non garantiscono risultati futuri.
  </footer>
</body>
</html>`;

  // Scarica
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `Staking-ATOM-Report-${new Date().toISOString().slice(0,10)}.html`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

/* ---------- STORICO RITIRI – FIX ID NUMERICI ---------- */
let ritiri = JSON.parse(localStorage.getItem('ritiri')) || { 1: 0, 2: 0 };

function saveRitiri() {
  localStorage.setItem('ritiri', JSON.stringify(ritiri));
}

function updateRitiriDisplay() {
  document.getElementById('totale_1').textContent = ritiri[1].toFixed(2) + ' €';
  document.getElementById('totale_2').textContent = ritiri[2].toFixed(2) + ' €';
}

document.addEventListener('click', e => {
  if (!e.target.classList.contains('addBtn') &&
      !e.target.classList.contains('del1Btn')) return;

  const target = parseInt(e.target.dataset.target, 10);
  const input  = document.getElementById(`importo_${target}`);
  const val    = parseFloat(input.value);

  if (isNaN(val) || val <= 0) {
    alert('Inserisci un importo positivo');
    return;
  }

  if (e.target.classList.contains('addBtn')) {
    ritiri[target] += val;
  } else if (e.target.classList.contains('del1Btn')) {
    ritiri[target] = Math.max(0, ritiri[target] - val);
  }

  saveRitiri();
  updateRitiriDisplay();
  input.value = '';
});

document.addEventListener('DOMContentLoaded', updateRitiriDisplay);