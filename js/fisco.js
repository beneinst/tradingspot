/* ══════════════════════════════════════════════
   CryptoFiscale — app.js
   LIFO / FIFO / ACM engine + CSV parser + UI
   ══════════════════════════════════════════════ */

'use strict';

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
const state = {
  operazioni: [],       // array di oggetti operazione
  risultati: null,      // output motore LIFO/FIFO/ACM
  sortCol: 'data',
  sortDir: 'asc',
  filterAsset: '',
  filterTipo: '',
  filterSearch: '',
  nextId: 1,
};

// ─────────────────────────────────────────────
//  UTILITY
// ─────────────────────────────────────────────
const fmt = (n, dec = 2) =>
  typeof n === 'number' && isFinite(n)
    ? n.toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec })
    : '—';

const fmtEur = (n) => n == null || !isFinite(n) ? '—' : `€ ${fmt(n, 2)}`;

const fmtQty = (n) =>
  typeof n === 'number' && isFinite(n)
    ? n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 8 })
    : '—';

const fiatSymbol = () => document.getElementById('valutaFiat').value === 'EUR' ? '€' : '$';

const parseNum = (s) => {
  if (s == null || s === '') return 0;
  // Gestisce sia "1.234,56" (IT) sia "1,234.56" (EN)
  const str = String(s).trim().replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) return parseFloat(str.replace(/\./g, '').replace(',', '.'));
  return parseFloat(str.replace(',', '.')) || 0;
};

const parseData = (s) => {
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d)) return d;
  // Prova formati italiani: DD/MM/YYYY o DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
  return null;
};

const toast = (msg, type = 'info') => {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3500);
};

const uid = () => state.nextId++;

// ─────────────────────────────────────────────
//  CSV PARSER
// ─────────────────────────────────────────────
const COLUMN_ALIASES = {
  data:        ['date','datetime','timestamp','data','ora','time','data_ora'],
  asset:       ['asset','coin','crypto','symbol','valuta','currency','ticker','coppia','pair'],
  tipo:        ['type','side','tipo','operazione','action','transaction type','transaction_type'],
  quantita:    ['qty','amount','quantity','quantita','quantità','importo','volume','executed'],
  prezzo:      ['price','prezzo','rate','corso','unit price','unit_price','avg price','avg_price'],
  commissione: ['fee','commission','commissione','tassa','fees','costo commissione'],
  note:        ['note','notes','memo','description','descrizione','commento'],
};

function detectSeparator(text) {
  const lines = text.split('\n').slice(0, 3);
  const commas = lines.reduce((a, l) => a + (l.match(/,/g) || []).length, 0);
  const semis  = lines.reduce((a, l) => a + (l.match(/;/g) || []).length, 0);
  return semis > commas ? ';' : ',';
}

function parseCSVLine(line, sep) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === sep && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

function mapHeaders(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const norm = h.toLowerCase().trim().replace(/['"]/g, '').replace(/\s+/g, '_');
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.some(a => norm.includes(a.replace(/\s/g, '_')) || a.replace(/\s/g,'_').includes(norm))) {
        if (!(field in map)) map[field] = i;
      }
    }
  });
  return map;
}

function normalizeTipo(v) {
  if (!v) return null;
  const s = v.toLowerCase().trim();
  if (['buy','acquisto','compra','acquista','b','in'].some(k => s.includes(k))) return 'buy';
  if (['sell','vendita','vendi','s','out'].some(k => s.includes(k))) return 'sell';
  return null;
}

function normalizeAsset(v) {
  if (!v) return '';
  // Se è un pair tipo "BTC/EUR" o "BTCEUR" → estrae la base
  let s = v.toUpperCase().trim().replace(/\s/g, '');
  if (s.includes('/')) s = s.split('/')[0];
  // Rimuove quote come USDT, EUR, BUSD, USD dalla fine
  const quotes = ['USDT','USDC','BUSD','EUR','USD','BTC','ETH','BNB'];
  for (const q of quotes) {
    if (s.endsWith(q) && s.length > q.length) {
      s = s.slice(0, s.length - q.length);
      break;
    }
  }
  return s.replace(/[^A-Z0-9]/g, '');
}

function importCSV(text, filename = '') {
  const sep = detectSeparator(text);
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return { ok: 0, errors: ['File vuoto o troppo corto.'] };

  const headers = parseCSVLine(lines[0], sep);
  const colMap = mapHeaders(headers);

  const required = ['data', 'asset', 'tipo', 'quantita', 'prezzo'];
  const missing = required.filter(f => !(f in colMap));
  if (missing.length > 0) {
    return { ok: 0, errors: [`Colonne non trovate: ${missing.join(', ')}. Controlla la guida formato CSV.`] };
  }

  let ok = 0;
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i], sep);
    if (row.every(c => !c.trim())) continue;

    const get = (field) => {
      const idx = colMap[field];
      return idx != null ? (row[idx] || '').trim() : '';
    };

    const data = parseData(get('data'));
    const assetRaw = get('asset');
    const asset = normalizeAsset(assetRaw) || assetRaw.toUpperCase().trim();
    const tipo = normalizeTipo(get('tipo'));
    const quantita = parseNum(get('quantita'));
    const prezzo = parseNum(get('prezzo'));
    const commissione = parseNum(get('commissione'));
    const note = get('note') || `Da ${filename}`;

    if (!data || isNaN(data)) { errors.push(`Riga ${i + 1}: data non valida ("${get('data')}")`); continue; }
    if (!asset) { errors.push(`Riga ${i + 1}: asset mancante`); continue; }
    if (!tipo)  { errors.push(`Riga ${i + 1}: tipo non riconosciuto ("${get('tipo')}")`); continue; }
    if (quantita <= 0) { errors.push(`Riga ${i + 1}: quantità non valida`); continue; }
    if (prezzo < 0) { errors.push(`Riga ${i + 1}: prezzo non valido`); continue; }

    aggiungiOperazione({ data, asset, tipo, quantita, prezzo, commissione, note }, false);
    ok++;
  }

  return { ok, errors };
}

// ─────────────────────────────────────────────
//  OPERAZIONI CRUD
// ─────────────────────────────────────────────
function aggiungiOperazione(op, refresh = true) {
  const o = {
    id: uid(),
    data: op.data instanceof Date ? op.data : new Date(op.data),
    asset: (op.asset || '').toUpperCase().trim(),
    tipo: op.tipo,
    quantita: op.quantita,
    prezzo: op.prezzo,
    commissione: op.commissione || 0,
    note: op.note || '',
    controvalore: op.quantita * op.prezzo,
  };
  state.operazioni.push(o);
  if (refresh) {
    renderTabella();
    aggiornaFiltroAsset();
    calcolaAutomatico();
  }
}

function eliminaOperazione(id) {
  state.operazioni = state.operazioni.filter(o => o.id !== id);
  renderTabella();
  aggiornaFiltroAsset();
  calcolaAutomatico();
  toast('Operazione eliminata', 'warn');
}

function modificaOperazione(id, dati) {
  const idx = state.operazioni.findIndex(o => o.id === id);
  if (idx < 0) return;
  const o = state.operazioni[idx];
  Object.assign(o, dati);
  o.controvalore = o.quantita * o.prezzo;
  state.operazioni[idx] = o;
  renderTabella();
  calcolaAutomatico();
  toast('Operazione modificata', 'success');
}

function eliminaSelezionate() {
  const checks = document.querySelectorAll('.row-check:checked');
  if (!checks.length) { toast('Seleziona almeno una riga', 'warn'); return; }
  const ids = [...checks].map(c => parseInt(c.dataset.id));
  state.operazioni = state.operazioni.filter(o => !ids.includes(o.id));
  renderTabella();
  aggiornaFiltroAsset();
  calcolaAutomatico();
  toast(`${ids.length} operazioni eliminate`, 'warn');
}

// ─────────────────────────────────────────────
//  RENDER TABELLA OPERAZIONI
// ─────────────────────────────────────────────
function operazioniFiltrate() {
  let ops = [...state.operazioni];

  if (state.filterTipo) ops = ops.filter(o => o.tipo === state.filterTipo);
  if (state.filterAsset) ops = ops.filter(o => o.asset === state.filterAsset);
  if (state.filterSearch) {
    const q = state.filterSearch.toLowerCase();
    ops = ops.filter(o => o.asset.toLowerCase().includes(q) || (o.note || '').toLowerCase().includes(q));
  }

  ops.sort((a, b) => {
    let va = a[state.sortCol], vb = b[state.sortCol];
    if (state.sortCol === 'data') { va = va?.getTime?.() || 0; vb = vb?.getTime?.() || 0; }
    if (va < vb) return state.sortDir === 'asc' ? -1 : 1;
    if (va > vb) return state.sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return ops;
}

function renderTabella() {
  const tbody = document.getElementById('tbodyOp');
  const ops = operazioniFiltrate();

  if (ops.length === 0) {
    tbody.innerHTML = `<tr class="empty-row" id="emptyRow">
      <td colspan="10">
        <div class="empty-state">
          <span class="empty-icon">📊</span>
          <p>Nessuna operazione ancora.<br>Importa un CSV o inserisci manualmente.</p>
        </div>
      </td>
    </tr>`;
    document.getElementById('conteggioOp').textContent = '0 operazioni';
    document.getElementById('riepilogoRapido').textContent = '';
    return;
  }

  tbody.innerHTML = ops.map(o => {
    const dt = o.data ? o.data.toLocaleDateString('it-IT', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }) : '—';
    const cls = o.tipo === 'buy' ? 'row-buy' : 'row-sell';
    const badgeCls = o.tipo === 'buy' ? 'badge-buy' : 'badge-sell';
    const badgeTxt = o.tipo === 'buy' ? '▲ ACQ' : '▼ VEN';
    return `<tr class="${cls}">
      <td><input type="checkbox" class="row-check" data-id="${o.id}"></td>
      <td>${dt}</td>
      <td><span class="badge-asset">${o.asset}</span></td>
      <td><span class="${badgeCls}">${badgeTxt}</span></td>
      <td class="num">${fmtQty(o.quantita)}</td>
      <td class="num">${fiatSymbol()} ${fmt(o.prezzo, 4)}</td>
      <td class="num">${o.commissione > 0 ? fiatSymbol() + ' ' + fmt(o.commissione, 4) : '—'}</td>
      <td class="num">${fiatSymbol()} ${fmt(o.controvalore, 2)}</td>
      <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(o.note || '')}">${escapeHtml(o.note || '')}</td>
      <td><div class="row-actions">
        <button class="btn-row" onclick="apriModifica(${o.id})">✏</button>
        <button class="btn-row del" onclick="eliminaOperazione(${o.id})">✕</button>
      </div></td>
    </tr>`;
  }).join('');

  // Footer
  const nAcq = ops.filter(o => o.tipo === 'buy').length;
  const nVen = ops.filter(o => o.tipo === 'sell').length;
  document.getElementById('conteggioOp').textContent = `${ops.length} operazioni`;
  document.getElementById('riepilogoRapido').textContent = `${nAcq} acquisti · ${nVen} vendite`;

  // Check all
  document.getElementById('checkAll').checked = false;
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function aggiornaFiltroAsset() {
  const assets = [...new Set(state.operazioni.map(o => o.asset))].sort();
  const sel = document.getElementById('filterAsset');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Tutti gli asset</option>' +
    assets.map(a => `<option value="${a}"${a === cur ? ' selected' : ''}>${a}</option>`).join('');
}

// ─────────────────────────────────────────────
//  MOTORE LIFO / FIFO / ACM
// ─────────────────────────────────────────────
function calcolaAutomatico() {
  if (state.operazioni.length === 0) {
    state.risultati = null;
    renderRiepilogo(null);
    return;
  }
  const anno = parseInt(document.getElementById('annoFiscale').value);
  const metodo = document.getElementById('metodoCalcolo').value;
  const risultati = calcolaFiscale(state.operazioni, anno, metodo);
  state.risultati = risultati;
  renderRiepilogo(risultati);
  renderReport(risultati, anno, metodo);
}

function calcolaFiscale(operazioni, anno, metodo) {
  // Raggruppa per asset, ordina cronologicamente
  const perAsset = {};
  for (const op of operazioni) {
    if (!perAsset[op.asset]) perAsset[op.asset] = [];
    perAsset[op.asset].push({ ...op });
  }

  const movimentiLIFO = [];  // dettaglio vendite con lotto usato
  const riepilogoAsset = {};

  for (const [asset, ops] of Object.entries(perAsset)) {
    const sorted = [...ops].sort((a, b) => a.data - b.data);

    // Stack lotti: ogni lotto { data, prezzo, quantita, rimanente }
    const lotti = [];
    let totAcquistato = 0, totVenduto = 0;
    let costoTotAcquisto = 0, proventTotVendita = 0;
    let costoFiscaleTot = 0;
    let plusTot = 0, minusTot = 0;

    for (const op of sorted) {
      if (op.tipo === 'buy') {
        lotti.push({ data: op.data, prezzo: op.prezzo, quantita: op.quantita, rimanente: op.quantita, note: op.note });
        totAcquistato += op.quantita;
        costoTotAcquisto += op.quantita * op.prezzo;

      } else if (op.tipo === 'sell') {
        totVenduto += op.quantita;
        const provento = op.quantita * op.prezzo;
        proventTotVendita += provento;

        // Applica il metodo selezionato
        const { costoFiscale, lottiConsumati, senzaLotto } =
          metodo === 'FIFO' ? consumaFIFO(lotti, op.quantita) :
          metodo === 'ACM'  ? consumaACM(lotti, op.quantita, costoTotAcquisto, totAcquistato) :
                              consumaLIFO(lotti, op.quantita);

        costoFiscaleTot += costoFiscale;
        const pl = provento - costoFiscale;
        if (pl >= 0) plusTot += pl; else minusTot += Math.abs(pl);

        // Solo per l'anno fiscale selezionato
        if (op.data.getFullYear() === anno) {
          movimentiLIFO.push({
            data: op.data,
            asset,
            qtaVenduta: op.quantita,
            prezzoVendita: op.prezzo,
            provento,
            costoFiscale,
            pl,
            lottiConsumati,
            senzaLotto,
            note: op.note,
          });
        }
      }
    }

    // Lotti residui
    const lottiResidui = lotti.filter(l => l.rimanente > 1e-12);

    riepilogoAsset[asset] = {
      totAcquistato, totVenduto,
      rimanenza: totAcquistato - totVenduto,
      costoMedioAcquisto: totAcquistato > 0 ? costoTotAcquisto / totAcquistato : 0,
      proventTotVendita,
      costoFiscaleTot,
      plusTot, minusTot,
      netPL: plusTot - minusTot,
      lottiResidui,
    };
  }

  // Solo movimenti dell'anno fiscale
  const movAnno = movimentiLIFO.filter(m => m.data.getFullYear() === anno);

  const totPlus  = movAnno.reduce((s, m) => s + (m.pl > 0 ? m.pl : 0), 0);
  const totMinus = movAnno.reduce((s, m) => s + (m.pl < 0 ? Math.abs(m.pl) : 0), 0);
  const netto = totPlus - totMinus;

  return {
    anno, metodo,
    totPlus, totMinus, netto,
    imposta: Math.max(0, netto * 0.26),
    movAnno,
    riepilogoAsset,
    avvisi: raccogliAvvisi(movAnno, riepilogoAsset),
  };
}

// ─── Consuma lotti LIFO ───────────────────────
function consumaLIFO(lotti, qtDaVendere) {
  let rimanente = qtDaVendere;
  let costoFiscale = 0;
  const lottiConsumati = [];
  let senzaLotto = 0;

  for (let i = lotti.length - 1; i >= 0 && rimanente > 1e-12; i--) {
    const lotto = lotti[i];
    const usabile = Math.min(lotto.rimanente, rimanente);
    costoFiscale += usabile * lotto.prezzo;
    lottiConsumati.push({ data: lotto.data, prezzo: lotto.prezzo, qty: usabile });
    lotto.rimanente -= usabile;
    rimanente -= usabile;
  }

  if (rimanente > 1e-12) {
    senzaLotto = rimanente;
    costoFiscale += rimanente * 0; // costo 0 per quantità senza lotto
  }

  return { costoFiscale, lottiConsumati, senzaLotto };
}

// ─── Consuma lotti FIFO ───────────────────────
function consumaFIFO(lotti, qtDaVendere) {
  let rimanente = qtDaVendere;
  let costoFiscale = 0;
  const lottiConsumati = [];
  let senzaLotto = 0;

  for (let i = 0; i < lotti.length && rimanente > 1e-12; i++) {
    const lotto = lotti[i];
    const usabile = Math.min(lotto.rimanente, rimanente);
    costoFiscale += usabile * lotto.prezzo;
    lottiConsumati.push({ data: lotto.data, prezzo: lotto.prezzo, qty: usabile });
    lotto.rimanente -= usabile;
    rimanente -= usabile;
  }

  if (rimanente > 1e-12) senzaLotto = rimanente;
  return { costoFiscale, lottiConsumati, senzaLotto };
}

// ─── Consuma lotti ACM (costo medio) ─────────
function consumaACM(lotti, qtDaVendere, costoTotAcquisto, totAcquistato) {
  const costoMedio = totAcquistato > 0 ? costoTotAcquisto / totAcquistato : 0;
  const costoFiscale = qtDaVendere * costoMedio;
  // Riduzione proporzionale lotti
  let qt = qtDaVendere;
  const lottiConsumati = [];
  for (let i = 0; i < lotti.length && qt > 1e-12; i++) {
    const usabile = Math.min(lotti[i].rimanente, qt);
    lottiConsumati.push({ data: lotti[i].data, prezzo: costoMedio, qty: usabile });
    lotti[i].rimanente -= usabile;
    qt -= usabile;
  }
  return { costoFiscale, lottiConsumati, senzaLotto: 0 };
}

function raccogliAvvisi(movAnno, riepilogoAsset) {
  const avvisi = [];
  for (const m of movAnno) {
    if (m.senzaLotto > 1e-12) {
      avvisi.push(`⚠ ${m.asset} (${m.data.toLocaleDateString('it-IT')}): venduta quantità ${fmtQty(m.senzaLotto)} senza lotto di acquisto corrispondente. Controllare dati.`);
    }
  }
  for (const [asset, r] of Object.entries(riepilogoAsset)) {
    if (r.rimanenza < -1e-8) {
      avvisi.push(`⚠ ${asset}: rimanenza negativa (${fmtQty(r.rimanenza)}). Potrebbero mancare acquisti precedenti.`);
    }
  }
  return avvisi;
}

// ─────────────────────────────────────────────
//  RENDER RIEPILOGO
// ─────────────────────────────────────────────
function renderRiepilogo(r) {
  if (!r) {
    document.getElementById('kpiPlus').textContent = '€ —';
    document.getElementById('kpiMinus').textContent = '€ —';
    document.getElementById('kpiNetto').textContent = '€ —';
    document.getElementById('kpiImposta').textContent = '€ —';
    document.getElementById('kpiPlusSub').textContent = '—';
    document.getElementById('kpiMinusSub').textContent = '—';
    document.getElementById('tbodyAsset').innerHTML = '<tr><td colspan="9" class="empty-cell">Nessun dato — aggiungi operazioni e clicca Ricalcola</td></tr>';
    document.getElementById('tbodyLIFO').innerHTML  = '<tr><td colspan="9" class="empty-cell">Nessun dato</td></tr>';
    document.getElementById('tbodyLotti').innerHTML = '<tr><td colspan="6" class="empty-cell">Nessun dato</td></tr>';
    return;
  }

  // KPI
  document.getElementById('kpiPlus').textContent    = fmtEur(r.totPlus);
  document.getElementById('kpiMinus').textContent   = fmtEur(r.totMinus);
  document.getElementById('kpiNetto').textContent   = fmtEur(r.netto);
  document.getElementById('kpiImposta').textContent = fmtEur(r.imposta);
  document.getElementById('kpiPlusSub').textContent = `${r.movAnno.filter(m => m.pl > 0).length} vendite in guadagno`;
  document.getElementById('kpiMinusSub').textContent= `${r.movAnno.filter(m => m.pl < 0).length} vendite in perdita`;
  document.getElementById('metodoLabel').textContent = r.metodo;

  // Tabella asset
  const tbodyAsset = document.getElementById('tbodyAsset');
  if (Object.keys(r.riepilogoAsset).length === 0) {
    tbodyAsset.innerHTML = '<tr><td colspan="9" class="empty-cell">Nessuna vendita nell\'anno selezionato</td></tr>';
  } else {
    tbodyAsset.innerHTML = Object.entries(r.riepilogoAsset).map(([asset, d]) => {
      const plCls = d.netPL >= 0 ? 'val-plus' : 'val-minus';
      const stato = d.netPL > 0 ? `<span style="color:var(--plus)">▲ Plusvalenza</span>` :
                    d.netPL < 0 ? `<span style="color:var(--minus)">▼ Minusvalenza</span>` :
                    `<span style="color:var(--text3)">— Pari</span>`;
      return `<tr>
        <td><span class="badge-asset">${asset}</span></td>
        <td class="num">${fmtQty(d.totAcquistato)}</td>
        <td class="num">${fmtQty(d.totVenduto)}</td>
        <td class="num">${fmtQty(d.rimanenza)}</td>
        <td class="num">${fiatSymbol()} ${fmt(d.costoMedioAcquisto, 4)}</td>
        <td class="num">${fiatSymbol()} ${fmt(d.proventTotVendita, 2)}</td>
        <td class="num">${fiatSymbol()} ${fmt(d.costoFiscaleTot, 2)}</td>
        <td class="num ${plCls}">${fiatSymbol()} ${fmt(d.netPL, 2)}</td>
        <td>${stato}</td>
      </tr>`;
    }).join('');
  }

  // Tabella movimenti LIFO
  const tbodyLIFO = document.getElementById('tbodyLIFO');
  if (r.movAnno.length === 0) {
    tbodyLIFO.innerHTML = `<tr><td colspan="9" class="empty-cell">Nessuna vendita nell'anno ${r.anno}</td></tr>`;
  } else {
    tbodyLIFO.innerHTML = r.movAnno.map(m => {
      const plCls = m.pl >= 0 ? 'val-plus' : 'val-minus';
      const lottoDesc = m.lottiConsumati.length > 0
        ? m.lottiConsumati.map(l =>
            `${l.data.toLocaleDateString('it-IT')} (${fmtQty(l.qty)} × ${fiatSymbol()} ${fmt(l.prezzo, 4)})`
          ).join('<br>')
        : '—';
      const warnSL = m.senzaLotto > 1e-12 ? ' <span class="val-warn" title="Quantità senza lotto">⚠</span>' : '';
      return `<tr class="${m.pl >= 0 ? 'row-buy' : 'row-sell'}">
        <td>${m.data.toLocaleDateString('it-IT')}</td>
        <td><span class="badge-asset">${m.asset}</span></td>
        <td class="num">${fmtQty(m.qtaVenduta)}${warnSL}</td>
        <td class="num">${fiatSymbol()} ${fmt(m.prezzoVendita, 4)}</td>
        <td class="num">${fiatSymbol()} ${fmt(m.provento, 2)}</td>
        <td style="font-size:0.75rem;line-height:1.6">${lottoDesc}</td>
        <td class="num">${fiatSymbol()} ${fmt(m.lottiConsumati[0]?.prezzo, 4)}</td>
        <td class="num">${fiatSymbol()} ${fmt(m.costoFiscale, 2)}</td>
        <td class="num ${plCls}">${fiatSymbol()} ${fmt(m.pl, 2)}</td>
      </tr>`;
    }).join('');
  }

  // Lotti residui
  const tbodyLotti = document.getElementById('tbodyLotti');
  const lottiResidui = [];
  for (const [asset, d] of Object.entries(r.riepilogoAsset)) {
    for (const l of d.lottiResidui) {
      lottiResidui.push({ asset, ...l });
    }
  }
  if (lottiResidui.length === 0) {
    tbodyLotti.innerHTML = '<tr><td colspan="6" class="empty-cell">Nessun lotto residuo</td></tr>';
  } else {
    tbodyLotti.innerHTML = lottiResidui.map(l => `<tr>
      <td><span class="badge-asset">${l.asset}</span></td>
      <td>${l.data.toLocaleDateString('it-IT')}</td>
      <td class="num">${fmtQty(l.rimanente)}</td>
      <td class="num">${fiatSymbol()} ${fmt(l.prezzo, 4)}</td>
      <td class="num">${fiatSymbol()} ${fmt(l.rimanente * l.prezzo, 2)}</td>
      <td style="font-size:0.75rem;color:var(--text3)">${escapeHtml(l.note || '')}</td>
    </tr>`).join('');
  }
}

// ─────────────────────────────────────────────
//  RENDER REPORT FISCALE
// ─────────────────────────────────────────────
function renderReport(r, anno, metodo) {
  if (!r) return;
  const today = new Date().toLocaleDateString('it-IT');

  document.getElementById('rAnno').textContent  = anno;
  document.getElementById('rAnno2').textContent = anno;
  document.getElementById('rAnno3').textContent = anno;
  document.getElementById('rMetodo').textContent = metodo;
  document.getElementById('rDataElab').textContent = today;
  document.getElementById('rDataFooter').textContent = today;

  const fmtR = (v) => `${fiatSymbol()} ${fmt(v, 2)}`;
  const plus  = r.totPlus;
  const minus = r.totMinus;
  const netto = r.netto;

  document.getElementById('rRT21').textContent   = fmtR(plus);
  document.getElementById('rRT22').textContent   = fmtR(minus);
  document.getElementById('rNetto').textContent  = fmtR(netto);
  document.getElementById('rImposta').textContent = fmtR(r.imposta);

  document.getElementById('rRT21').className   = 'val-plus';
  document.getElementById('rRT22').className   = 'val-minus';
  document.getElementById('rNetto').className  = netto >= 0 ? 'val-plus' : 'val-minus';

  // Nota soglia 2000€
  const notaEl = document.getElementById('rNotaSoglia');
  if (netto > 0 && netto < 2000) {
    notaEl.innerHTML = `ℹ Per l'anno ${anno} la soglia di imponibilità è di € 2.000. Verificare con il proprio commercialista se si è al di sotto della soglia esentasse (art. 67, comma 1-ter TUIR).`;
    notaEl.style.display = '';
  } else if (netto <= 0) {
    notaEl.innerHTML = `ℹ Netto negativo o nullo: nessuna imposta dovuta per ${anno}. Verificare possibilità di riporto minusvalenze agli anni successivi.`;
    notaEl.style.display = '';
  } else {
    notaEl.style.display = 'none';
  }

  // Dettaglio vendite
  const detailBody = document.getElementById('reportBodyDetail');
  if (r.movAnno.length === 0) {
    detailBody.innerHTML = `<tr><td colspan="7" class="empty-cell">Nessuna vendita nell'anno ${anno}</td></tr>`;
  } else {
    detailBody.innerHTML = r.movAnno.map(m => {
      const plCls = m.pl >= 0 ? 'val-plus' : 'val-minus';
      const plStr = (m.pl >= 0 ? '+' : '') + fmtR(m.pl);
      return `<tr>
        <td>${m.data.toLocaleDateString('it-IT')}</td>
        <td>${m.asset}</td>
        <td>${fmtQty(m.qtaVenduta)}</td>
        <td>${fmtR(m.prezzoVendita)}</td>
        <td>${fmtR(m.provento)}</td>
        <td>${fmtR(m.costoFiscale)}</td>
        <td class="${plCls}">${plStr}</td>
      </tr>`;
    }).join('');
  }

  // Lotti residui report
  const lottiResidui = [];
  for (const [asset, d] of Object.entries(r.riepilogoAsset)) {
    for (const l of d.lottiResidui) {
      lottiResidui.push({ asset, ...l });
    }
  }
  const rLotti = document.getElementById('reportBodyLotti');
  if (lottiResidui.length === 0) {
    rLotti.innerHTML = '<tr><td colspan="5" class="empty-cell">Nessun lotto residuo al 31/12/' + anno + '</td></tr>';
  } else {
    rLotti.innerHTML = lottiResidui.map(l => `<tr>
      <td>${l.asset}</td>
      <td>${l.data.toLocaleDateString('it-IT')}</td>
      <td>${fmtQty(l.rimanente)}</td>
      <td>${fmtR(l.prezzo)}</td>
      <td>${fmtR(l.rimanente * l.prezzo)}</td>
    </tr>`).join('');
  }

  // Avvisi
  const avvisiEl = document.getElementById('reportAvvisi');
  if (r.avvisi.length === 0) {
    avvisiEl.innerHTML = `<p class="avviso-ok">✓ Nessun avviso per l'anno ${anno}.</p>`;
  } else {
    avvisiEl.innerHTML = r.avvisi.map(a => `<p class="avviso-warn">${a}</p>`).join('');
  }
}

// ─────────────────────────────────────────────
//  MODAL MODIFICA
// ─────────────────────────────────────────────
function apriModifica(id) {
  const op = state.operazioni.find(o => o.id === id);
  if (!op) return;

  const dt = op.data instanceof Date ? op.data : new Date(op.data);
  const isoLocal = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  document.getElementById('editId').value = id;
  document.getElementById('editAsset').value = op.asset;
  document.getElementById('editTipo').value = op.tipo;
  document.getElementById('editData').value = isoLocal;
  document.getElementById('editQuantita').value = op.quantita;
  document.getElementById('editPrezzo').value = op.prezzo;
  document.getElementById('editCommissione').value = op.commissione || 0;
  document.getElementById('editNote').value = op.note || '';

  document.getElementById('modalEdit').classList.remove('hidden');
}

function chiudiModale() {
  document.getElementById('modalEdit').classList.add('hidden');
}

// ─────────────────────────────────────────────
//  EXPORT / IMPORT SESSIONE
// ─────────────────────────────────────────────
function esportaCSV() {
  if (!state.operazioni.length) { toast('Nessuna operazione da esportare', 'warn'); return; }
  const header = 'data,asset,tipo,quantita,prezzo,commissione,controvalore,note';
  const rows = state.operazioni.map(o =>
    [
      o.data.toISOString(),
      o.asset, o.tipo,
      o.quantita, o.prezzo,
      o.commissione, o.controvalore,
      `"${(o.note || '').replace(/"/g, '""')}"`,
    ].join(',')
  );
  scaricaFile('operazioni_crypto.csv', 'text/csv', [header, ...rows].join('\n'));
  toast('CSV esportato', 'success');
}

function esportaDettaglio() {
  if (!state.risultati) { toast('Calcola prima il report', 'warn'); return; }
  const r = state.risultati;
  const header = 'data,asset,qta_venduta,prezzo_vendita,provento,costo_fiscale,plus_minus';
  const rows = r.movAnno.map(m =>
    [m.data.toISOString(), m.asset, m.qtaVenduta, m.prezzoVendita,
     m.provento.toFixed(2), m.costoFiscale.toFixed(2), m.pl.toFixed(2)].join(',')
  );
  scaricaFile(`dettaglio_${r.anno}_${r.metodo}.csv`, 'text/csv', [header, ...rows].join('\n'));
  toast('Dettaglio esportato', 'success');
}

function esportaEsempioCSV() {
  const content = `data,asset,tipo,quantita,prezzo,commissione,note
2024-01-15 10:30,BTC,buy,0.5,38000,5.50,Acquisto Binance
2024-02-20 14:00,ETH,buy,2.0,2200,3.20,Acquisto Coinbase
2024-04-10 09:15,BTC,sell,0.25,52000,4.80,Vendita parziale
2024-06-01 11:00,ETH,buy,1.0,3000,2.50,Accumulo
2024-09-05 16:30,ETH,sell,1.5,2800,3.10,Vendita ETH
2024-11-20 08:00,BTC,sell,0.1,70000,5.00,Vendita novembre`;
  scaricaFile('esempio_cryptofiscale.csv', 'text/csv', content);
  toast('CSV di esempio scaricato', 'success');
}

function scaricaFile(nome, tipo, contenuto) {
  const blob = new Blob([contenuto], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
}

function salvaSessione() {
  const data = JSON.stringify({
    operazioni: state.operazioni.map(o => ({ ...o, data: o.data.toISOString() })),
    nextId: state.nextId,
  });
  scaricaFile('sessione_cryptofiscale.json', 'application/json', data);
  toast('Sessione salvata', 'success');
}

function caricaSessione(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      state.operazioni = parsed.operazioni.map(o => ({ ...o, data: new Date(o.data) }));
      state.nextId = parsed.nextId || (Math.max(0, ...state.operazioni.map(o => o.id)) + 1);
      renderTabella();
      aggiornaFiltroAsset();
      calcolaAutomatico();
      toast(`Sessione caricata: ${state.operazioni.length} operazioni`, 'success');
    } catch {
      toast('File sessione non valido', 'error');
    }
  };
  reader.readAsText(file);
}

function esportaReportTesto() {
  if (!state.risultati) { toast('Calcola prima il report', 'warn'); return; }
  const r = state.risultati;
  const sep = '═'.repeat(60);
  const lines = [
    sep,
    `  PROSPETTO FISCALE CRIPTOVALUTE — Anno ${r.anno}`,
    `  Metodo: ${r.metodo} | Data: ${new Date().toLocaleDateString('it-IT')}`,
    sep, '',
    `  RT21 Plusvalenze:     ${fmtEur(r.totPlus)}`,
    `  RT22 Minusvalenze:    ${fmtEur(r.totMinus)}`,
    `  ─────────────────────────────────────────`,
    `  Netto imponibile:     ${fmtEur(r.netto)}`,
    `  RT29 Imposta 26%:     ${fmtEur(r.imposta)}`,
    '', '  DETTAGLIO PER ASSET:', '',
    ...Object.entries(r.riepilogoAsset).map(([a, d]) =>
      `  ${a.padEnd(8)} | Acquistato: ${fmtQty(d.totAcquistato).padStart(14)} | Venduto: ${fmtQty(d.totVenduto).padStart(14)} | P/L: ${fmtEur(d.netPL)}`
    ),
    '',
    r.avvisi.length ? '  AVVISI:\n' + r.avvisi.map(a => '  ' + a).join('\n') : '  Nessun avviso.',
    '',
    '  DISCLAIMER: Solo uso informativo. Verificare con un commercialista.',
    sep,
  ];
  scaricaFile(`report_${r.anno}_${r.metodo}.txt`, 'text/plain', lines.join('\n'));
  toast('Report testo esportato', 'success');
}

// ─────────────────────────────────────────────
//  INIT E EVENTI
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // ── Tab navigation ──
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // ── Tipo toggle ──
  document.querySelectorAll('.tipo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('inTipo').value = btn.dataset.value;
    });
  });

  // ── Form manuale ──
  const setData = () => {
    // Default data = ora
    const now = new Date();
    const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('inData').value = iso;
  };
  setData();

  // Live preview controvalore
  const updatePreview = () => {
    const qty = parseFloat(document.getElementById('inQuantita').value) || 0;
    const prc = parseFloat(document.getElementById('inPrezzo').value) || 0;
    const tot = qty * prc;
    document.getElementById('totalePreview').textContent = `${fiatSymbol()} ${fmt(tot, 2)}`;
  };
  document.getElementById('inQuantita').addEventListener('input', updatePreview);
  document.getElementById('inPrezzo').addEventListener('input', updatePreview);
  document.getElementById('valutaFiat').addEventListener('change', () => {
    document.getElementById('fiatLabel').textContent = document.getElementById('valutaFiat').value;
    document.getElementById('fiatLabel2').textContent = document.getElementById('valutaFiat').value;
    updatePreview();
    renderTabella();
    calcolaAutomatico();
  });

  document.getElementById('formManuale').addEventListener('submit', (e) => {
    e.preventDefault();
    const dt = document.getElementById('inData').value;
    const asset = document.getElementById('inAsset').value.toUpperCase().trim();
    const tipo = document.getElementById('inTipo').value;
    const qty = parseFloat(document.getElementById('inQuantita').value);
    const prc = parseFloat(document.getElementById('inPrezzo').value);
    const fee = parseFloat(document.getElementById('inCommissione').value) || 0;
    const note = document.getElementById('inNote').value;

    if (!asset || !dt || !tipo || !(qty > 0) || !(prc >= 0)) {
      toast('Compila tutti i campi obbligatori', 'error');
      return;
    }

    aggiungiOperazione({ data: new Date(dt), asset, tipo, quantita: qty, prezzo: prc, commissione: fee, note });
    renderTabella();
    aggiornaFiltroAsset();
    calcolaAutomatico();
    toast(`${tipo === 'buy' ? 'Acquisto' : 'Vendita'} ${asset} aggiunto`, 'success');

    // Reset form (mantieni asset e tipo, resetta numeri)
    document.getElementById('inQuantita').value = '';
    document.getElementById('inPrezzo').value = '';
    document.getElementById('inCommissione').value = '0';
    document.getElementById('inNote').value = '';
    setData();
    updatePreview();
  });

  document.getElementById('btnResetForm').addEventListener('click', () => {
    document.getElementById('formManuale').reset();
    document.getElementById('inTipo').value = 'buy';
    document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.tipo-btn[data-value="buy"]').classList.add('active');
    setData(); updatePreview();
  });

  // ── CSV Drop zone ──
  const dropZone = document.getElementById('dropZone');
  const browseBtn = document.getElementById('browseBtn');
  const csvInput = document.getElementById('csvInput');

  dropZone.addEventListener('click', (e) => { if (e.target !== browseBtn) csvInput.click(); });
  browseBtn.addEventListener('click', (e) => { e.stopPropagation(); csvInput.click(); });

  ['dragover', 'dragenter'].forEach(ev => dropZone.addEventListener(ev, (e) => {
    e.preventDefault(); dropZone.classList.add('drag-over');
  }));
  ['dragleave', 'drop'].forEach(ev => dropZone.addEventListener(ev, (e) => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
  }));
  dropZone.addEventListener('drop', (e) => {
    const files = [...e.dataTransfer.files].filter(f => f.name.endsWith('.csv'));
    files.forEach(processCSVFile);
  });
  csvInput.addEventListener('change', (e) => {
    [...e.target.files].forEach(processCSVFile);
    e.target.value = '';
  });

  function processCSVFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const { ok, errors } = importCSV(e.target.result, file.name);
      renderTabella();
      aggiornaFiltroAsset();
      calcolaAutomatico();
      if (ok > 0) toast(`${ok} operazioni importate da "${file.name}"`, 'success');
      if (errors.length > 0) {
        errors.slice(0, 5).forEach(err => toast(err, 'warn'));
        if (errors.length > 5) toast(`...e altri ${errors.length - 5} errori`, 'warn');
      }
    };
    reader.readAsText(file);
  }

  // ── Filtri tabella ──
  document.getElementById('searchOp').addEventListener('input', (e) => {
    state.filterSearch = e.target.value; renderTabella();
  });
  document.getElementById('filterTipo').addEventListener('change', (e) => {
    state.filterTipo = e.target.value; renderTabella();
  });
  document.getElementById('filterAsset').addEventListener('change', (e) => {
    state.filterAsset = e.target.value; renderTabella();
  });

  // Sort
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (state.sortCol === col) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      else { state.sortCol = col; state.sortDir = 'asc'; }
      renderTabella();
    });
  });

  // Check all
  document.getElementById('checkAll').addEventListener('change', (e) => {
    document.querySelectorAll('.row-check').forEach(c => c.checked = e.target.checked);
  });

  // Elimina selezionate
  document.getElementById('btnCancellaSelezionate').addEventListener('click', eliminaSelezionate);

  // ── Modal modifica ──
  document.getElementById('modalClose').addEventListener('click', chiudiModale);
  document.getElementById('btnModalCancel').addEventListener('click', chiudiModale);
  document.getElementById('modalBackdrop').addEventListener('click', chiudiModale);

  document.getElementById('formEdit').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById('editId').value);
    modificaOperazione(id, {
      asset: document.getElementById('editAsset').value.toUpperCase().trim(),
      tipo:  document.getElementById('editTipo').value,
      data:  new Date(document.getElementById('editData').value),
      quantita:    parseFloat(document.getElementById('editQuantita').value),
      prezzo:      parseFloat(document.getElementById('editPrezzo').value),
      commissione: parseFloat(document.getElementById('editCommissione').value) || 0,
      note: document.getElementById('editNote').value,
    });
    chiudiModale();
  });

  // ── Ricalcola ──
  document.getElementById('btnCalcola').addEventListener('click', calcolaAutomatico);
  document.getElementById('annoFiscale').addEventListener('change', calcolaAutomatico);
  document.getElementById('metodoCalcolo').addEventListener('change', () => {
    document.getElementById('metodoLabel').textContent = document.getElementById('metodoCalcolo').value;
    calcolaAutomatico();
  });

  // ── Export / Import sessione ──
  document.getElementById('btnSalvaSessione').addEventListener('click', salvaSessione);
  document.getElementById('btnCaricaSessione').addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,.csv';
    inp.onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.name.endsWith('.json')) caricaSessione(f);
      else processCSVFile(f);
    };
    inp.click();
  });

  // ── Export buttons ──
  document.getElementById('btnEsportaCSV').addEventListener('click', esportaCSV);
  document.getElementById('btnEsportaDettaglio').addEventListener('click', esportaDettaglio);
  document.getElementById('btnEsempioCSV').addEventListener('click', esportaEsempioCSV);
  document.getElementById('btnEsportaReport').addEventListener('click', esportaReportTesto);
  document.getElementById('btnStampa').addEventListener('click', () => window.print());

  // Init
  renderTabella();
  aggiornaFiltroAsset();
});