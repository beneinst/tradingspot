/* ==========================================================
   Sync Core - FlowChart
   Motore di sincronizzazione blockchain condiviso da sync.html
   e dal pulsante "Sincronizza" in Panoramica (index.html).
   Nessuna dipendenza dal DOM: ogni funzione pubblica accetta un
   callback di log opzionale `onLog(msg, livello)`.
   ========================================================== */
(function (global) {
  "use strict";

  const CFG_KEY   = 'cryptoWatchedAddresses';
  const STATE_KEY = 'cryptoSyncState';
  const OPS_KEY   = 'cryptoOperations';
  const ATOM_KEY  = 'atomOperations';
  const BTC_KEY   = 'btcWalletEntries';
  const USDC_KEY  = 'usdcWalletEntries';

  const COINGECKO_IDS = { ATOM: 'cosmos', BTC: 'bitcoin', POL: 'polygon-ecosystem-token', USDC: 'usd-coin' };
  // Contratto USDC nativo su Polygon PoS. Se detieni USDC.e (bridged) cambialo qui.
  const USDC_CONTRACT = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';

  function getConfig() { return JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); }
  function saveConfig(c) { localStorage.setItem(CFG_KEY, JSON.stringify(c)); }
  function getSyncState() { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
  function saveSyncState(s) { localStorage.setItem(STATE_KEY, JSON.stringify(s)); }
  function getOperations() { return JSON.parse(localStorage.getItem(OPS_KEY) || '[]'); }
  function saveOperations(ops) { localStorage.setItem(OPS_KEY, JSON.stringify(ops)); }
  function getWalletStore(key) { return JSON.parse(localStorage.getItem(key) || '[]'); }
  function saveWalletStore(key, arr) { localStorage.setItem(key, JSON.stringify(arr)); }
  function uidWallet() { return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function startOfYesterday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 1);
    return d.getTime();
  }

  function syncSince(state, key) {
    const yesterday = startOfYesterday();
    const savedSince = state[key] && Number(state[key].since);
    return Number.isFinite(savedSince) ? Math.min(savedSince, yesterday) : yesterday;
  }

  /* --------------------------------------------------------
     CACHE PREZZI STORICI COINGECKO (EUR)
     -------------------------------------------------------- */
  async function getPrezzoStoricoEUR(assetSymbol, dateISO) {
    const cacheKey = 'coingeckoPriceCache';
    const cache = JSON.parse(localStorage.getItem(cacheKey) || '{}');
    const d = new Date(dateISO);
    const dayKey = `${assetSymbol}_${d.toISOString().slice(0, 10)}`;
    if (cache[dayKey] != null) return cache[dayKey];

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const dateParam = `${dd}-${mm}-${yyyy}`;
    const id = COINGECKO_IDS[assetSymbol];

    const res = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/history?date=${dateParam}&localization=false`);
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const data = await res.json();
    const eur = data && data.market_data && data.market_data.current_price && data.market_data.current_price.eur;
    if (typeof eur !== 'number') throw new Error('Prezzo EUR non disponibile');

    cache[dayKey] = eur;
    localStorage.setItem(cacheKey, JSON.stringify(cache));
    return eur;
  }

  /* --------------------------------------------------------
     MERGE — dedup su txHash, non tocca le voci manuali esistenti
     -------------------------------------------------------- */
  function mergeOperazioni(nuove) {
    if (!nuove.length) return 0;
    const ops = getOperations();
    const hashEsistenti = new Set(ops.filter(o => o.txHash).map(o => o.txHash));
    let aggiunte = 0;
    nuove.forEach(op => {
      if (op.txHash && hashEsistenti.has(op.txHash)) return;
      ops.push(op);
      aggiunte++;
    });
    ops.sort((a, b) => new Date(a.date) - new Date(b.date));
    saveOperations(ops);
    return aggiunte;
  }

  function mergeWallet(key, nuoveEntries) {
    if (!nuoveEntries.length) return 0;
    const entries = getWalletStore(key);
    const hashEsistenti = new Set(entries.filter(e => e.txHash).map(e => e.txHash));
    let aggiunte = 0;
    nuoveEntries.forEach(e => {
      if (e.txHash && hashEsistenti.has(e.txHash)) return;
      entries.push(e);
      aggiunte++;
    });
    saveWalletStore(key, entries);
    return aggiunte;
  }

  function nuovaOperazione(type, amount, dateISO, txHash, costEur) {
    const op = {
      id: Date.now() + Math.random(), date: dateISO, amount, type,
      note: `Auto-import (${txHash.slice(0, 10)}…)`, source: 'auto', txHash,
    };
    if (costEur != null && costEur > 0) op.costEur = costEur;
    return op;
  }

  function entryAtom(netAtom, dateISO, txHash, valoreEur) {
    return {
      id: Date.now() + Math.random(), date: dateISO,
      type: netAtom > 0 ? 'deposito' : 'ritiro',
      note: `Auto-import (${txHash.slice(0, 10)}…)`,
      currency: 'EUR',
      totalAtom: Math.abs(netAtom),
      totalUsd: valoreEur != null ? valoreEur : 0,
      txHash,
    };
  }

  function entryBtc(netBtc, dateISO, txHash, valoreEur) {
    return {
      id: uidWallet(), date: dateISO,
      type: netBtc > 0 ? 'deposito' : 'prelievo',
      qty: Math.abs(netBtc),
      spent: valoreEur != null ? valoreEur : 0,
      note: `Auto-import (${txHash.slice(0, 10)}…)`,
      txHash,
    };
  }

  // USDC: la pagina Wallet USDC non gestisce prelievi — importiamo solo i depositi.
  function entryUsdc(netUsdc, dateISO, txHash, valoreEur) {
    if (netUsdc <= 0) return null;
    return {
      id: uidWallet(), date: dateISO,
      qty: netUsdc,
      spent: valoreEur != null ? valoreEur : netUsdc,
      note: `Auto-import (${txHash.slice(0, 10)}…)`,
      txHash,
    };
  }

  /* --------------------------------------------------------
     BITCOIN — mempool.space
     -------------------------------------------------------- */
  async function sincronizzaBtc(address, sinceMs, onLog) {
    const res = await fetch(`https://mempool.space/api/address/${address}/txs`);
    if (!res.ok) throw new Error(`mempool.space HTTP ${res.status}`);
    const txs = await res.json();

    const nuove = [];
    for (const tx of txs) {
      if (!tx.status || !tx.status.confirmed || !tx.status.block_time) continue;
      const tsMs = tx.status.block_time * 1000;
      if (tsMs < sinceMs) continue;

      const inSat = tx.vin.reduce((s, v) => s + (v.prevout && v.prevout.scriptpubkey_address === address ? v.prevout.value : 0), 0);
      const outSat = tx.vout.reduce((s, v) => s + (v.scriptpubkey_address === address ? v.value : 0), 0);
      const netBtc = (outSat - inSat) / 1e8;
      if (Math.abs(netBtc) < 0.00000001) continue;

      const dateISO = new Date(tsMs).toISOString();
      let costEur = null;
      if (netBtc > 0) {
        try { costEur = (await getPrezzoStoricoEUR('BTC', dateISO)) * netBtc; }
        catch (e) { if (onLog) onLog(`⚠️ Prezzo storico BTC non recuperato per ${tx.txid.slice(0, 10)}…: ${e.message}`, 'err'); }
      }
      nuove.push(nuovaOperazione('BTC', netBtc, dateISO, tx.txid, costEur));
    }
    return nuove;
  }

  /* --------------------------------------------------------
     COSMOS / ATOM — LCD pubblico
     -------------------------------------------------------- */
  function decodeCosmosValue(value) {
    if (typeof value !== 'string') return '';
    try {
      const decoded = atob(value);
      return /^[\x20-\x7E]*$/.test(decoded) ? decoded : value;
    } catch (_) {
      return value;
    }
  }

  function atomAmountFromValue(value) {
    const decoded = decodeCosmosValue(value);
    const matches = decoded.match(/(?:^|,)(\d+)uatom\b/g) || [];
    return matches.reduce((total, item) => total + Number(item.replace(/[^0-9]/g, '')), 0);
  }

  function cosmosTransferEvents(txResp) {
    const events = [];
    (txResp.logs || []).forEach(logEntry => events.push(...(logEntry.events || [])));
    (txResp.events || []).forEach(event => events.push(event));
    return events.filter(event => event.type === 'transfer');
  }

  async function fetchCosmosTxs(address, direction, onLog) {
    const query = `transfer.${direction === 'in' ? 'recipient' : 'sender'}='${address}'`;
    const lcds = [
      'https://rest.cosmos.directory/cosmoshub',
      'https://cosmos-rest.publicnode.com',
      'https://cosmos-api.polkachu.com',
    ];
    const params = [
      `query=${encodeURIComponent(query)}&order_by=ORDER_BY_DESC&pagination.limit=100`,
      `events=${encodeURIComponent(query)}&order_by=ORDER_BY_DESC&pagination.limit=100`,
    ];
    let lastError = null;

    for (const lcd of lcds) {
      for (const param of params) {
        try {
          const res = await fetch(`${lcd}/cosmos/tx/v1beta1/txs?${param}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (Array.isArray(data.tx_responses)) return data.tx_responses;
          throw new Error('risposta Cosmos senza tx_responses');
        } catch (error) {
          lastError = error;
        }
      }
    }

    throw new Error(`Cosmos LCD ${direction} non disponibile: ${lastError ? lastError.message : 'errore sconosciuto'}`);
  }

  async function sincronizzaAtom(address, sinceMs, onLog) {
    const grezze = [];

    for (const direction of ['in', 'out']) {
      const txResponses = await fetchCosmosTxs(address, direction, onLog);
      txResponses.forEach(txResp => {
        const tsMs = new Date(txResp.timestamp).getTime();
        if (!Number.isFinite(tsMs) || tsMs < sinceMs) return;

        let uatom = 0;
        cosmosTransferEvents(txResp).forEach(ev => {
          const attrs = ev.attributes || [];
          const get = key => attrs.find(a => decodeCosmosValue(a.key) === key);
          const recipient = decodeCosmosValue(get('recipient')?.value);
          const sender = decodeCosmosValue(get('sender')?.value);
          const amount = atomAmountFromValue(get('amount')?.value);
          if (direction === 'in' && recipient === address) uatom += amount;
          if (direction === 'out' && sender === address) uatom -= amount;
        });
        if (uatom === 0) return;

        grezze.push({ netAtom: uatom / 1e6, dateISO: new Date(tsMs).toISOString(), hash: txResp.txhash });
      });
    }

    const perHash = new Map();
    grezze.forEach(n => {
      if (!perHash.has(n.hash)) perHash.set(n.hash, n);
      else perHash.get(n.hash).netAtom += n.netAtom;
    });

    const risultato = [];
    for (const { netAtom, dateISO, hash } of perHash.values()) {
      if (Math.abs(netAtom) < 0.000001) continue;
      let costEur = null;
      if (netAtom > 0) {
        try { costEur = (await getPrezzoStoricoEUR('ATOM', dateISO)) * netAtom; }
        catch (e) { if (onLog) onLog(`⚠️ Prezzo storico ATOM non recuperato per ${hash.slice(0, 10)}…: ${e.message}`, 'err'); }
      }
      risultato.push(nuovaOperazione('ATOM', netAtom, dateISO, hash, costEur));
    }
    return risultato;
  }

  /* --------------------------------------------------------
     POLYGON — POL nativo + USDC, via Polygonscan
     -------------------------------------------------------- */
  async function sincronizzaPolygon(address, apiKey, sinceMs, onLog) {
    if (!apiKey) { if (onLog) onLog('⚠️ Nessuna Polygonscan API key: salto POL/USDC', 'err'); return []; }
    const nuove = [];

    {
      const url = `https://api.polygonscan.com/api?module=account&action=txlist&address=${address}&sort=desc&apikey=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === '1') {
        for (const tx of data.result) {
          const tsMs = parseInt(tx.timeStamp, 10) * 1000;
          if (tsMs < sinceMs || tx.isError === '1') continue;
          const valuePol = parseInt(tx.value, 10) / 1e18;
          if (valuePol === 0) continue;
          const net = tx.to.toLowerCase() === address.toLowerCase() ? valuePol : -valuePol;
          const dateISO = new Date(tsMs).toISOString();
          let costEur = null;
          if (net > 0) {
            try { costEur = (await getPrezzoStoricoEUR('POL', dateISO)) * net; }
            catch (e) { if (onLog) onLog(`⚠️ Prezzo storico POL non recuperato: ${e.message}`, 'err'); }
          }
          nuove.push(nuovaOperazione('POL', net, dateISO, tx.hash, costEur));
        }
      } else if (data.message !== 'No transactions found') {
        if (onLog) onLog(`⚠️ Polygonscan txlist: ${data.message}`, 'err');
      }
    }

    {
      const url = `https://api.polygonscan.com/api?module=account&action=tokentx&contractaddress=${USDC_CONTRACT}&address=${address}&sort=desc&apikey=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === '1') {
        for (const tx of data.result) {
          const tsMs = parseInt(tx.timeStamp, 10) * 1000;
          if (tsMs < sinceMs) continue;
          const decimals = parseInt(tx.tokenDecimal, 10) || 6;
          const valueUsdc = parseInt(tx.value, 10) / Math.pow(10, decimals);
          if (valueUsdc === 0) continue;
          const net = tx.to.toLowerCase() === address.toLowerCase() ? valueUsdc : -valueUsdc;
          const dateISO = new Date(tsMs).toISOString();
          let costEur = null;
          if (net > 0) {
            try { costEur = (await getPrezzoStoricoEUR('USDC', dateISO)) * net; }
            catch { costEur = net; }
          }
          nuove.push(nuovaOperazione('USDC', net, dateISO, tx.hash + '-usdc', costEur));
        }
      } else if (data.message !== 'No transactions found') {
        if (onLog) onLog(`⚠️ Polygonscan tokentx: ${data.message}`, 'err');
      }
    }

    return nuove;
  }

  /* --------------------------------------------------------
     ORCHESTRAZIONE — funzione pubblica principale
     -------------------------------------------------------- */
  async function sincronizzaTutto(onLog) {
    const log = onLog || function () {};
    const cfg = getConfig();
    const state = getSyncState();
    let totaleImportate = 0;

    const jobs = [
      { key: 'btc', label: 'Bitcoin', addr: cfg.btc, fn: () => sincronizzaBtc(cfg.btc, syncSince(state, 'btc'), log) },
      { key: 'atom', label: 'Cosmos', addr: cfg.atom, fn: () => sincronizzaAtom(cfg.atom, syncSince(state, 'atom'), log) },
      { key: 'evm', label: 'Polygon', addr: cfg.evm, fn: () => sincronizzaPolygon(cfg.evm, cfg.polygonscanKey, syncSince(state, 'evm'), log) },
    ];

    for (const job of jobs) {
      if (!job.addr) { log(`⏭️ ${job.label}: nessun indirizzo configurato`, 'info'); continue; }
      try {
        log(`🔍 Verifico ${job.label}…`, 'info');
        const nuove = await job.fn();
        const aggiunte = mergeOperazioni(nuove);
        totaleImportate += aggiunte;
        log(`✅ ${job.label} → Panoramica: ${aggiunte} nuove transazioni`, 'ok');

        if (job.key === 'atom') {
          const n = mergeWallet(ATOM_KEY, nuove.map(o => entryAtom(o.amount, o.date, o.txHash, o.costEur)));
          log(`✅ Cosmos → Wallet Atom: ${n} nuove voci`, 'ok');
        } else if (job.key === 'btc') {
          const n = mergeWallet(BTC_KEY, nuove.map(o => entryBtc(o.amount, o.date, o.txHash, o.costEur)));
          log(`✅ Bitcoin → Wallet BTC: ${n} nuove voci`, 'ok');
        } else if (job.key === 'evm') {
          const usdcOps = nuove.filter(o => o.type === 'USDC');
          const n = mergeWallet(USDC_KEY, usdcOps.map(o => entryUsdc(o.amount, o.date, o.txHash, o.costEur)).filter(Boolean));
          log(`✅ Polygon → Wallet USDC: ${n} nuove voci (solo depositi)`, 'ok');
        }

        state[job.key] = { since: Date.now() };
      } catch (e) {
        log(`❌ ${job.label}: ${e.message}`, 'err');
      }
    }

    saveSyncState(state);
    return totaleImportate;
  }

  global.SyncEngine = { getConfig, saveConfig, sincronizzaTutto };
})(window);
