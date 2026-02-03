/*  ATOM / USDC  Portfolio – Binance - Figment
    Autore: you
    ----------------------------------------------------------- */

const STORAGE_KEY_3 = 'atomPortfolio_3';
const CACHE_DURATION_3 = 5 * 60 * 1000; // 5 min
let priceCache_3 = null;

let portfolio_3 = {
  symbol_3: 'ATOM',
  quote_3 : 'USDC',
  entries_3: []              // { qtyAtom_3, spentUsdc_3, priceAtBuy_3, ts_3, note_3 }
};

/* ---------- FUNZIONI PREZZO ---------- */
async function fetchAtomPrice_3() {
  const now_3 = Date.now();
  if (priceCache_3 && (now_3 - priceCache_3.ts_3) < CACHE_DURATION_3) return priceCache_3.price_3;

  try {
    const res_3 = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ATOMUSDC ');
    if (!res_3.ok) throw new Error(res_3.status);
    const data_3 = await res_3.json();
    const price_3 = parseFloat(data_3.price);
    priceCache_3 = { price_3, ts_3: now_3 };
    return price_3;
  } catch {
    console.warn('Impossibile ottenere prezzo ATOM/USDC');
    return null;
  }
}

/* ---------- FUNZIONI STORAGE ---------- */
function save_3() {
  localStorage.setItem(STORAGE_KEY_3, JSON.stringify(portfolio_3));
}
function load_3() {
  const raw_3 = localStorage.getItem(STORAGE_KEY_3);
  if (raw_3) portfolio_3 = { ...portfolio_3, ...JSON.parse(raw_3) };
}

/* ---------- CALCOLO STATISTICHE ---------- */
function calcStats_3() {
  let spentTot_3 = 0, qtyTot_3 = 0;
  portfolio_3.entries_3.forEach(e_3 => {
    spentTot_3 += e_3.spentUsdc_3;
    qtyTot_3   += e_3.qtyAtom_3;
  });
  const avgPrice_3 = qtyTot_3 > 0 ? spentTot_3 / qtyTot_3 : 0;
  return { spentTot_3, qtyTot_3, avgPrice_3 };
}

/* ---------- RENDER (stile Trade) ---------- */
async function render_3() {
  const cont_3 = document.getElementById('portfolio_3');
  if (!cont_3) return;

  const { spentTot_3, qtyTot_3, avgPrice_3 } = calcStats_3();
  const curPrice_3 = await fetchAtomPrice_3();
  const curVal_3   = curPrice_3 ? qtyTot_3 * curPrice_3 : 0;
  const pnl_3      = curVal_3 - spentTot_3;
  const pnlPct_3   = spentTot_3 ? (pnl_3 / spentTot_3) * 100 : 0;
  const pnlClass_3 = pnl_3 >= 0 ? 'positive' : 'negative';

  let rows_3 = '';
  portfolio_3.entries_3.forEach((e_3, i_3) => {
    const entryVal_3 = curPrice_3 ? (e_3.qtyAtom_3 * curPrice_3).toFixed(2) : '-';
    rows_3 += `
      <tr>
        <td>${i_3 + 1}</td>
        <td>${new Date(e_3.ts_3).toLocaleDateString('it-IT')}</td>
        <td>${e_3.qtyAtom_3.toFixed(6)}</td>
        <td>$${e_3.spentUsdc_3.toFixed(2)}</td>
        <td>$${e_3.priceAtBuy_3.toFixed(4)}</td>
        <td>$${entryVal_3}</td>
        <td>${e_3.note_3 || '-'}</td>
        <td><button onclick="deleteEntry_3(${i_3})" class="btn-icon-muted">🗑️</button></td>
      </tr>`;
  });

  cont_3.innerHTML = `
    <div class="summary-grid">
      <div class="summary-item">
        <div class="label">Investito USDC</div>
        <div class="value">$${spentTot_3.toFixed(2)}</div>
      </div>
      <div class="summary-item">
        <div class="label">Detenuto ATOM</div>
        <div class="value">${qtyTot_3.toFixed(6)}</div>
      </div>
      <div class="summary-item">
        <div class="label">Prezzo Medio</div>
        <div class="value">$${avgPrice_3.toFixed(4)}</div>
      </div>
      ${curPrice_3 ? `
      <div class="summary-item">
        <div class="label">Prezzo Attuale</div>
        <div class="value">$${curPrice_3.toFixed(4)}</div>
      </div>
      <div class="summary-item">
        <div class="label">Valore Attuale</div>
        <div class="value">$${curVal_3.toFixed(2)}</div>
      </div>
      <div class="summary-item">
        <div class="label">P&L</div>
        <div class="value ${pnlClass_3}">$${pnl_3.toFixed(2)} (${pnlPct_3.toFixed(2)}%)</div>
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
          <tbody>${rows_3}</tbody>
        </table>
      </div>
    </div>
  `;
}

/* ---------- AGGIUNTA ENTRY ---------- */
function addEntry_3() {
  const qty_3   = parseFloat(document.getElementById('qtyAtom_3').value);
  const spent_3 = parseFloat(document.getElementById('spentUsdc_3').value);
  const note_3  = document.getElementById('note_3').value.trim();

  if (!qty_3 || !spent_3 || qty_3 <= 0 || spent_3 <= 0) {
    alert('Inserisci valori validi!');
    return;
  }

  portfolio_3.entries_3.unshift({
    qtyAtom_3: qty_3,
    spentUsdc_3: spent_3,
    priceAtBuy_3: spent_3 / qty_3,
    ts_3: Date.now(),
    note_3
  });
  save_3();
  render_3();
  document.getElementById('entryForm_3').reset();
}

/* ---------- CANCELLA ENTRY ---------- */
window.deleteEntry_3 = idx_3 => {
  if (confirm('Eliminare questa entry?')) {
    portfolio_3.entries_3.splice(idx_3, 1);
    save_3();
    render_3();
  }
};

/* ---------- INIZIALIZZAZIONE ---------- */
document.addEventListener('DOMContentLoaded', () => {
  load_3();
  render_3();
  document.getElementById('entryForm_3').addEventListener('submit', e_3 => {
    e_3.preventDefault();
    addEntry_3();
  });
});

/* ---------- DOWNLOAD REPORT HTML ---------- */
document.getElementById('btnDownload_3').addEventListener('click', async () => {
  const { spentTot_3, qtyTot_3, avgPrice_3 } = calcStats_3();
  const curPrice_3 = await fetchAtomPrice_3();
  const curVal_3   = curPrice_3 ? qtyTot_3 * curPrice_3 : 0;
  const pnl_3      = curVal_3 - spentTot_3;
  const pnlPct_3   = spentTot_3 ? (pnl_3 / spentTot_3) * 100 : 0;

  let rows_3 = '';
  portfolio_3.entries_3.forEach((e_3, idx_3) => {
    rows_3 += `
      <tr>
        <td>${idx_3 + 1}</td>
        <td>${new Date(e_3.ts_3).toLocaleDateString('it-IT')} ${new Date(e_3.ts_3).toLocaleTimeString('it-IT')}</td>
        <td>${e_3.qtyAtom_3.toFixed(6)}</td>
        <td>$${e_3.spentUsdc_3.toFixed(2)}</td>
        <td>$${e_3.priceAtBuy_3.toFixed(4)}</td>
        <td>${e_3.note_3 || '-'}</td>
      </tr>`;
  });

  const html_3 = `
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
  <h1>Staking ATOM | Val. Figment</h1>
  <p style="text-align:center; color:#666;">Report generato il ${new Date().toLocaleString('it-IT')}</p>

  <div class="summary">
    <div class="box">
      <div class="label">Investito USDC</div>
      <div class="value">$${spentTot_3.toFixed(2)}</div>
    </div>
    <div class="box">
      <div class="label">Detenuto ATOM</div>
      <div class="value">${qtyTot_3.toFixed(6)}</div>
    </div>
    <div class="box">
      <div class="label">Prezzo Medio</div>
      <div class="value">$${avgPrice_3.toFixed(4)}</div>
    </div>
    ${curPrice_3 ? `
    <div class="box">
      <div class="label">Prezzo Attuale</div>
      <div class="value">$${curPrice_3.toFixed(4)}</div>
    </div>
    <div class="box">
      <div class="label">Valore Attuale</div>
      <div class="value">$${curVal_3.toFixed(2)}</div>
    </div>
    <div class="box">
      <div class="label">P&L</div>
      <div class="value ${pnl_3 >= 0 ? 'positive' : 'negative'}">
        $${pnl_3.toFixed(2)} (${pnlPct_3.toFixed(2)}%)
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
    <tbody>${rows_3}</tbody>
  </table>

  <footer style="margin-top:40px; text-align:center; font-size:.8em; color:#888;">
    Dati prezzo da Binance API – Le performance passate non garantiscono risultati futuri.
  </footer>
</body>
</html>`;

  // Scarica
  const blob_3 = new Blob([html_3], { type: 'text/html;charset=utf-8' });
  const url_3  = URL.createObjectURL(blob_3);
  const a_3    = document.createElement('a');
  a_3.href     = url_3;
  a_3.download = `Staking-ATOM-Figment-${new Date().toISOString().slice(0,10)}.html`;
  a_3.style.display = 'none';
  document.body.appendChild(a_3);
  a_3.click();
  a_3.remove();
  URL.revokeObjectURL(url_3);
});

/* ---------- STORICO RITIRI – FIX ID NUMERICI ---------- */
let ritiri_3 = JSON.parse(localStorage.getItem('ritiri_3')) || { 1: 0, 2: 0 };

function saveRitiri_3() {
  localStorage.setItem('ritiri_3', JSON.stringify(ritiri_3));
}

function updateRitiriDisplay_3() {
  document.getElementById('totale_1_3').textContent = ritiri_3[1].toFixed(2) + ' €';
  document.getElementById('totale_3_3').textContent = ritiri_3[2].toFixed(2) + ' €';
}

document.addEventListener('click', e_3 => {
  if (!e_3.target.classList.contains('addBtn_3') &&
      !e_3.target.classList.contains('del1Btn_3')) return;

  const target_3 = parseInt(e_3.target.dataset.target, 10);
  const input_3  = document.getElementById(`importo_${target_3}_3`);
  const val_3    = parseFloat(input_3.value);

  if (isNaN(val_3) || val_3 <= 0) {
    alert('Inserisci un importo positivo');
    return;
  }

  if (e_3.target.classList.contains('addBtn_3')) {
    ritiri_3[target_3] += val_3;
  } else if (e_3.target.classList.contains('del1Btn_3')) {
    ritiri_3[target_3] = Math.max(0, ritiri_3[target_3] - val_3);
  }

  saveRitiri_3();
  updateRitiriDisplay_3();
  input_3.value = '';
});

document.addEventListener('DOMContentLoaded', updateRitiriDisplay_3);