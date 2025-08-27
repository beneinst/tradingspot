/*  ATOM / USDC  Portfolio – Binance (pagina 2) - Ledger
    Autore: you
    ----------------------------------------------------------- */

const STORAGE_KEY_1 = 'atomPortfolio_1';
const CACHE_DURATION_1 = 5 * 60 * 1000; // 5 min
let priceCache_1 = null;

let portfolio_1 = {
  symbol: 'ATOM',
  quote : 'USDC',
  entries: []              // { qtyAtom_1, spentUsdc_1, priceAtBuy_1, ts_1, note_1 }
};

/* ---------- FUNZIONI PREZZO ---------- */
async function fetchAtomPrice_1() {
  const now_1 = Date.now();
  if (priceCache_1 && (now_1 - priceCache_1.ts) < CACHE_DURATION_1) return priceCache_1.price;

  try {
    const res_1 = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ATOMUSDC');
    if (!res_1.ok) throw new Error(res_1.status);
    const data_1 = await res_1.json();
    const price_1 = parseFloat(data_1.price);
    priceCache_1 = { price: price_1, ts: now_1 };
    return price_1;
  } catch {
    console.warn('Impossibile ottenere prezzo ATOM/USDC');
    return null;
  }
}

/* ---------- FUNZIONI STORAGE ---------- */
function save_1() {
  localStorage.setItem(STORAGE_KEY_1, JSON.stringify(portfolio_1));
}
function load_1() {
  const raw_1 = localStorage.getItem(STORAGE_KEY_1);
  if (raw_1) portfolio_1 = { ...portfolio_1, ...JSON.parse(raw_1) };
}

/* ---------- CALCOLO STATISTICHE ---------- */
function calcStats_1() {
  let spentTot_1 = 0, qtyTot_1 = 0;
  portfolio_1.entries.forEach(e_1 => {
    spentTot_1 += e_1.spentUsdc;
    qtyTot_1   += e_1.qtyAtom;
  });
  const avgPrice_1 = qtyTot_1 > 0 ? spentTot_1 / qtyTot_1 : 0;
  return { spentTot_1, qtyTot_1, avgPrice_1 };
}

/* ---------- RENDER (stile Trade) ---------- */
async function render_1() {
  const cont_1 = document.getElementById('portfolio_1');
  if (!cont_1) return;

  const { spentTot_1, qtyTot_1, avgPrice_1 } = calcStats_1();
  const curPrice_1 = await fetchAtomPrice_1();
  const curVal_1   = curPrice_1 ? qtyTot_1 * curPrice_1 : 0;
  const pnl_1      = curVal_1 - spentTot_1;
  const pnlPct_1   = spentTot_1 ? (pnl_1 / spentTot_1) * 100 : 0;
  const pnlClass_1 = pnl_1 >= 0 ? 'positive' : 'negative';

  let rows_1 = '';
  portfolio_1.entries.forEach((e_1, i_1) => {
    const entryVal_1 = curPrice_1 ? (e_1.qtyAtom * curPrice_1).toFixed(2) : '-';
    rows_1 += `
      <tr>
        <td>${i_1 + 1}</td>
        <td>${new Date(e_1.ts).toLocaleDateString('it-IT')}</td>
        <td>${e_1.qtyAtom.toFixed(6)}</td>
        <td>$${e_1.spentUsdc.toFixed(2)}</td>
        <td>$${e_1.priceAtBuy.toFixed(4)}</td>
        <td>$${entryVal_1}</td>
        <td>${e_1.note || '-'}</td>
        <td><button onclick="deleteEntry_1(${i_1})" class="btn-del">↪</button></td>
      </tr>`;
  });

  cont_1.innerHTML = `
    <div class="summary-grid">
      <div class="summary-item">
        <div class="label">Investito USDC</div>
        <div class="value">$${spentTot_1.toFixed(2)}</div>
      </div>
      <div class="summary-item">
        <div class="label">Detenuto ATOM</div>
        <div class="value">${qtyTot_1.toFixed(6)}</div>
      </div>
      <div class="summary-item">
        <div class="label">Prezzo Medio</div>
        <div class="value">$${avgPrice_1.toFixed(4)}</div>
      </div>
      ${curPrice_1 ? `
      <div class="summary-item">
        <div class="label">Prezzo Attuale</div>
        <div class="value">$${curPrice_1.toFixed(4)}</div>
      </div>
      <div class="summary-item">
        <div class="label">Valore Attuale</div>
        <div class="value">$${curVal_1.toFixed(2)}</div>
      </div>
      <div class="summary-item">
        <div class="label">P&L</div>
        <div class="value ${pnlClass_1}">$${pnl_1.toFixed(2)} (${pnlPct_1.toFixed(2)}%)</div>
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
          <tbody>${rows_1}</tbody>
        </table>
      </div>
    </div>
  `;
}

/* ---------- AGGIUNTA ENTRY ---------- */
function addEntry_1() {
  const qty_1   = parseFloat(document.getElementById('qtyAtom_1').value);
  const spent_1 = parseFloat(document.getElementById('spentUsdc_1').value);
  const note_1  = document.getElementById('note_1').value.trim();

  if (!qty_1 || !spent_1 || qty_1 <= 0 || spent_1 <= 0) {
    alert('Inserisci valori validi!');
    return;
  }

  portfolio_1.entries.unshift({
    qtyAtom: qty_1,
    spentUsdc: spent_1,
    priceAtBuy: spent_1 / qty_1,
    ts: Date.now(),
    note: note_1
  });
  save_1();
  render_1();
  document.getElementById('entryForm_1').reset();
}

/* ---------- CANCELLA ENTRY ---------- */
window.deleteEntry_1 = idx_1 => {
  if (confirm('Eliminare questa entry?')) {
    portfolio_1.entries.splice(idx_1, 1);
    save_1();
    render_1();
  }
};

/* ---------- INIZIALIZZAZIONE ---------- */
document.addEventListener('DOMContentLoaded', () => {
  load_1();
  render_1();
  document.getElementById('entryForm_1').addEventListener('submit', e => {
    e.preventDefault();
    addEntry_1();
  });
});

/* ---------- DOWNLOAD REPORT HTML ---------- */
document.getElementById('btnDownload_1').addEventListener('click', async () => {
  const { spentTot_1, qtyTot_1, avgPrice_1 } = calcStats_1();
  const curPrice_1 = await fetchAtomPrice_1();
  const curVal_1   = curPrice_1 ? qtyTot_1 * curPrice_1 : 0;
  const pnl_1      = curVal_1 - spentTot_1;
  const pnlPct_1   = spentTot_1 ? (pnl_1 / spentTot_1) * 100 : 0;

  let rows_1 = '';
  portfolio_1.entries.forEach((e_1, idx_1) => {
    rows_1 += `
      <tr>
        <td>${idx_1 + 1}</td>
        <td>${new Date(e_1.ts).toLocaleDateString('it-IT')} ${new Date(e_1.ts).toLocaleTimeString('it-IT')}</td>
        <td>${e_1.qtyAtom.toFixed(6)}</td>
        <td>$${e_1.spentUsdc.toFixed(2)}</td>
        <td>$${e_1.priceAtBuy.toFixed(4)}</td>
        <td>${e_1.note || '-'}</td>
      </tr>`;
  });

  const html_1 = `<!doctype html>
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
  <h1>Staking ATOM | Val. Ledger by Chorus One</h1>
  <p style="text-align:center; color:#666;">Report generato il ${new Date().toLocaleString('it-IT')}</p>

  <div class="summary">
    <div class="box">
      <div class="label">Investito USDC</div>
      <div class="value">$${spentTot_1.toFixed(2)}</div>
    </div>
    <div class="box">
      <div class="label">Detenuto ATOM</div>
      <div class="value">${qtyTot_1.toFixed(6)}</div>
    </div>
    <div class="box">
      <div class="label">Prezzo Medio</div>
      <div class="value">$${avgPrice_1.toFixed(4)}</div>
    </div>
    ${curPrice_1 ? `
    <div class="box">
      <div class="label">Prezzo Attuale</div>
      <div class="value">$${curPrice_1.toFixed(4)}</div>
    </div>
    <div class="box">
      <div class="label">Valore Attuale</div>
      <div class="value">$${curVal_1.toFixed(2)}</div>
    </div>
    <div class="box">
      <div class="label">P&L</div>
      <div class="value ${pnl_1 >= 0 ? 'positive' : 'negative'}">
        $${pnl_1.toFixed(2)} (${pnlPct_1.toFixed(2)}%)
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
    <tbody>${rows_1}</tbody>
  </table>

  <footer style="margin-top:40px; text-align:center; font-size:.8em; color:#888;">
    Dati prezzo da Binance API – Le performance passate non garantiscono risultati futuri.
  </footer>
</body>
</html>`;

  // Scarica
  const blob_1 = new Blob([html_1], { type: 'text/html;charset=utf-8' });
  const url_1  = URL.createObjectURL(blob_1);
  const a_1    = document.createElement('a');
  a_1.href     = url_1;
  a_1.download = `Staking-ATOM-Ledger-${new Date().toISOString().slice(0,10)}.html`;
  a_1.style.display = 'none';
  document.body.appendChild(a_1);
  a_1.click();
  a_1.remove();
  URL.revokeObjectURL(url_1);
});

/* ---------- STORICO RITIRI – FIX ID NUMERICI ---------- */
let ritiri_1 = JSON.parse(localStorage.getItem('ritiri_1')) || { 1: 0, 2: 0 };

function saveRitiri_1() {
  localStorage.setItem('ritiri_1', JSON.stringify(ritiri_1));
}

function updateRitiriDisplay_1() {
  document.getElementById('totale_1_1').textContent = ritiri_1[1].toFixed(2) + ' €';
  document.getElementById('totale_2_1').textContent = ritiri_1[2].toFixed(2) + ' €';
}

document.addEventListener('click', e => {
  if (!e.target.classList.contains('addBtn_1') &&
      !e.target.classList.contains('del1Btn_1')) return;

  const target_1 = parseInt(e.target.dataset.target, 10);
  const input_1  = document.getElementById(`importo_${target_1}_1`);
  const val_1    = parseFloat(input_1.value);

  if (isNaN(val_1) || val_1 <= 0) {
    alert('Inserisci un importo positivo');
    return;
  }

  if (e.target.classList.contains('addBtn_1')) {
    ritiri_1[target_1] += val_1;
  } else if (e.target.classList.contains('del1Btn_1')) {
    ritiri_1[target_1] = Math.max(0, ritiri_1[target_1] - val_1);
  }

  saveRitiri_1();
  updateRitiriDisplay_1();
  input_1.value = '';
});

document.addEventListener('DOMContentLoaded', updateRitiriDisplay_1);
