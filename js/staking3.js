/*  ATOM / USDC  Portfolio – Binance - Figment
    Autore: you
    ----------------------------------------------------------- */

const STORAGE_KEY_2 = 'atomPortfolio_2';
const CACHE_DURATION_2 = 5 * 60 * 1000; // 5 min
let priceCache_2 = null;

let portfolio_2 = {
  symbol_2: 'ATOM',
  quote_2 : 'USDC',
  entries_2: []              // { qtyAtom_2, spentUsdc_2, priceAtBuy_2, ts_2, note_2 }
};

/* ---------- FUNZIONI PREZZO ---------- */
async function fetchAtomPrice_2() {
  const now_2 = Date.now();
  if (priceCache_2 && (now_2 - priceCache_2.ts_2) < CACHE_DURATION_2) return priceCache_2.price_2;

  try {
    const res_2 = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ATOMUSDC ');
    if (!res_2.ok) throw new Error(res_2.status);
    const data_2 = await res_2.json();
    const price_2 = parseFloat(data_2.price);
    priceCache_2 = { price_2, ts_2: now_2 };
    return price_2;
  } catch {
    console.warn('Impossibile ottenere prezzo ATOM/USDC');
    return null;
  }
}

/* ---------- FUNZIONI STORAGE ---------- */
function save_2() {
  localStorage.setItem(STORAGE_KEY_2, JSON.stringify(portfolio_2));
}
function load_2() {
  const raw_2 = localStorage.getItem(STORAGE_KEY_2);
  if (raw_2) portfolio_2 = { ...portfolio_2, ...JSON.parse(raw_2) };
}

/* ---------- CALCOLO STATISTICHE ---------- */
function calcStats_2() {
  let spentTot_2 = 0, qtyTot_2 = 0;
  portfolio_2.entries_2.forEach(e_2 => {
    spentTot_2 += e_2.spentUsdc_2;
    qtyTot_2   += e_2.qtyAtom_2;
  });
  const avgPrice_2 = qtyTot_2 > 0 ? spentTot_2 / qtyTot_2 : 0;
  return { spentTot_2, qtyTot_2, avgPrice_2 };
}

/* ---------- RENDER (stile Trade) ---------- */
async function render_2() {
  const cont_2 = document.getElementById('portfolio_2');
  if (!cont_2) return;

  const { spentTot_2, qtyTot_2, avgPrice_2 } = calcStats_2();
  const curPrice_2 = await fetchAtomPrice_2();
  const curVal_2   = curPrice_2 ? qtyTot_2 * curPrice_2 : 0;
  const pnl_2      = curVal_2 - spentTot_2;
  const pnlPct_2   = spentTot_2 ? (pnl_2 / spentTot_2) * 100 : 0;
  const pnlClass_2 = pnl_2 >= 0 ? 'positive' : 'negative';

  let rows_2 = '';
  portfolio_2.entries_2.forEach((e_2, i_2) => {
    const entryVal_2 = curPrice_2 ? (e_2.qtyAtom_2 * curPrice_2).toFixed(2) : '-';
    rows_2 += `
      <tr>
        <td>${i_2 + 1}</td>
        <td>${new Date(e_2.ts_2).toLocaleDateString('it-IT')}</td>
        <td>${e_2.qtyAtom_2.toFixed(6)}</td>
        <td>$${e_2.spentUsdc_2.toFixed(2)}</td>
        <td>$${e_2.priceAtBuy_2.toFixed(4)}</td>
        <td>$${entryVal_2}</td>
        <td>${e_2.note_2 || '-'}</td>
        <td><button onclick="deleteEntry_2(${i_2})" class="btn-icon-muted">🗑️</button></td>
      </tr>`;
  });

  cont_2.innerHTML = `
    <div class="summary-grid">
      <div class="summary-item">
        <div class="label">Investito USDC</div>
        <div class="value">$${spentTot_2.toFixed(2)}</div>
      </div>
      <div class="summary-item">
        <div class="label">Detenuto ATOM</div>
        <div class="value">${qtyTot_2.toFixed(6)}</div>
      </div>
      <div class="summary-item">
        <div class="label">Prezzo Medio</div>
        <div class="value">$${avgPrice_2.toFixed(4)}</div>
      </div>
      ${curPrice_2 ? `
      <div class="summary-item">
        <div class="label">Prezzo Attuale</div>
        <div class="value">$${curPrice_2.toFixed(4)}</div>
      </div>
      <div class="summary-item">
        <div class="label">Valore Attuale</div>
        <div class="value">$${curVal_2.toFixed(2)}</div>
      </div>
      <div class="summary-item">
        <div class="label">P&L</div>
        <div class="value ${pnlClass_2}">$${pnl_2.toFixed(2)} (${pnlPct_2.toFixed(2)}%)</div>
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
          <tbody>${rows_2}</tbody>
        </table>
      </div>
    </div>
  `;
}

/* ---------- AGGIUNTA ENTRY ---------- */
function addEntry_2() {
  const qty_2   = parseFloat(document.getElementById('qtyAtom_2').value);
  const spent_2 = parseFloat(document.getElementById('spentUsdc_2').value);
  const note_2  = document.getElementById('note_2').value.trim();

  if (!qty_2 || !spent_2 || qty_2 <= 0 || spent_2 <= 0) {
    alert('Inserisci valori validi!');
    return;
  }

  portfolio_2.entries_2.unshift({
    qtyAtom_2: qty_2,
    spentUsdc_2: spent_2,
    priceAtBuy_2: spent_2 / qty_2,
    ts_2: Date.now(),
    note_2
  });
  save_2();
  render_2();
  document.getElementById('entryForm_2').reset();
}

/* ---------- CANCELLA ENTRY ---------- */
window.deleteEntry_2 = idx_2 => {
  if (confirm('Eliminare questa entry?')) {
    portfolio_2.entries_2.splice(idx_2, 1);
    save_2();
    render_2();
  }
};

/* ---------- INIZIALIZZAZIONE ---------- */
document.addEventListener('DOMContentLoaded', () => {
  load_2();
  render_2();
  document.getElementById('entryForm_2').addEventListener('submit', e_2 => {
    e_2.preventDefault();
    addEntry_2();
  });
});

/* ---------- DOWNLOAD REPORT HTML ---------- */
document.getElementById('btnDownload_2').addEventListener('click', async () => {
  const { spentTot_2, qtyTot_2, avgPrice_2 } = calcStats_2();
  const curPrice_2 = await fetchAtomPrice_2();
  const curVal_2   = curPrice_2 ? qtyTot_2 * curPrice_2 : 0;
  const pnl_2      = curVal_2 - spentTot_2;
  const pnlPct_2   = spentTot_2 ? (pnl_2 / spentTot_2) * 100 : 0;

  let rows_2 = '';
  portfolio_2.entries_2.forEach((e_2, idx_2) => {
    rows_2 += `
      <tr>
        <td>${idx_2 + 1}</td>
        <td>${new Date(e_2.ts_2).toLocaleDateString('it-IT')} ${new Date(e_2.ts_2).toLocaleTimeString('it-IT')}</td>
        <td>${e_2.qtyAtom_2.toFixed(6)}</td>
        <td>$${e_2.spentUsdc_2.toFixed(2)}</td>
        <td>$${e_2.priceAtBuy_2.toFixed(4)}</td>
        <td>${e_2.note_2 || '-'}</td>
      </tr>`;
  });

  const html_2 = `
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
      <div class="value">$${spentTot_2.toFixed(2)}</div>
    </div>
    <div class="box">
      <div class="label">Detenuto ATOM</div>
      <div class="value">${qtyTot_2.toFixed(6)}</div>
    </div>
    <div class="box">
      <div class="label">Prezzo Medio</div>
      <div class="value">$${avgPrice_2.toFixed(4)}</div>
    </div>
    ${curPrice_2 ? `
    <div class="box">
      <div class="label">Prezzo Attuale</div>
      <div class="value">$${curPrice_2.toFixed(4)}</div>
    </div>
    <div class="box">
      <div class="label">Valore Attuale</div>
      <div class="value">$${curVal_2.toFixed(2)}</div>
    </div>
    <div class="box">
      <div class="label">P&L</div>
      <div class="value ${pnl_2 >= 0 ? 'positive' : 'negative'}">
        $${pnl_2.toFixed(2)} (${pnlPct_2.toFixed(2)}%)
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
    <tbody>${rows_2}</tbody>
  </table>

  <footer style="margin-top:40px; text-align:center; font-size:.8em; color:#888;">
    Dati prezzo da Binance API – Le performance passate non garantiscono risultati futuri.
  </footer>
</body>
</html>`;

  // Scarica
  const blob_2 = new Blob([html_2], { type: 'text/html;charset=utf-8' });
  const url_2  = URL.createObjectURL(blob_2);
  const a_2    = document.createElement('a');
  a_2.href     = url_2;
  a_2.download = `Staking-ATOM-Figment-${new Date().toISOString().slice(0,10)}.html`;
  a_2.style.display = 'none';
  document.body.appendChild(a_2);
  a_2.click();
  a_2.remove();
  URL.revokeObjectURL(url_2);
});

/* ---------- STORICO RITIRI – FIX ID NUMERICI ---------- */
let ritiri_2 = JSON.parse(localStorage.getItem('ritiri_2')) || { 1: 0, 2: 0 };

function saveRitiri_2() {
  localStorage.setItem('ritiri_2', JSON.stringify(ritiri_2));
}

function updateRitiriDisplay_2() {
  document.getElementById('totale_1_2').textContent = ritiri_2[1].toFixed(2) + ' €';
  document.getElementById('totale_2_2').textContent = ritiri_2[2].toFixed(2) + ' €';
}

document.addEventListener('click', e_2 => {
  if (!e_2.target.classList.contains('addBtn_2') &&
      !e_2.target.classList.contains('del1Btn_2')) return;

  const target_2 = parseInt(e_2.target.dataset.target, 10);
  const input_2  = document.getElementById(`importo_${target_2}_2`);
  const val_2    = parseFloat(input_2.value);

  if (isNaN(val_2) || val_2 <= 0) {
    alert('Inserisci un importo positivo');
    return;
  }

  if (e_2.target.classList.contains('addBtn_2')) {
    ritiri_2[target_2] += val_2;
  } else if (e_2.target.classList.contains('del1Btn_2')) {
    ritiri_2[target_2] = Math.max(0, ritiri_2[target_2] - val_2);
  }

  saveRitiri_2();
  updateRitiriDisplay_2();
  input_2.value = '';
});

document.addEventListener('DOMContentLoaded', updateRitiriDisplay_2);