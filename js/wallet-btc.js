/* ==========================================================
   Wallet BTC - FlowChart
   - Prezzo BTC live in EUR (CoinGecko, prezzo diretto)
   - Gestione entry: Deposito / Restaking (da ATOM)
   - Tabella con colore rosso/verde su prezzo di carico
   - Grafico cumulato (deposito, restaking, totale)
   - Cancellazione entry (posizione venduta/uscita dal wallet)
   - Export CSV
   ========================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "btcWalletEntries";
  const PRICE_REFRESH_MS = 30000; // 30s
  // CoinGecko fornisce già il prezzo diretto in EUR: evita una seconda
  // chiamata a frankfurter.app, che blocca via CORS se la pagina è aperta
  // come file locale (origin "null") invece che da un server/GitHub Pages.
  const COINGECKO_URL =
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur";

  let entries = loadEntries();
  let livePriceEur = null;
  let btcChart = null;

  // ---------- Storage ----------
  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Errore lettura storage BTC:", e);
      return [];
    }
  }

  function saveEntries() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function uid() {
    return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function fmtEur(v) {
    return v.toLocaleString("it-IT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    });
  }

  // ---------- Prezzo live (EUR diretto da CoinGecko) ----------
  async function fetchLivePrice() {
    const dot = document.getElementById("priceDot");
    const priceEl = document.getElementById("btcLivePrice");
    const updatedEl = document.getElementById("priceUpdated");

    try {
      const res = await fetch(COINGECKO_URL);
      if (!res.ok) throw new Error("Risposta non valida da CoinGecko");

      const data = await res.json();
      const priceEur = data && data.bitcoin && data.bitcoin.eur;
      if (!priceEur) throw new Error("Prezzo non trovato nella risposta");

      livePriceEur = priceEur;
      priceEl.textContent = fmtEur(livePriceEur);
      updatedEl.textContent =
        "aggiornato alle " + new Date().toLocaleTimeString("it-IT");
      if (dot) dot.style.background = "#3ddc84";
    } catch (err) {
      console.error("Errore fetch prezzo BTC:", err);
      if (updatedEl)
        updatedEl.textContent =
          "prezzo non disponibile (rete/API) — ultimo valore mantenuto";
      if (dot) dot.style.background = "#ff4d6d";
    } finally {
      // Renderizza sempre: tabella e grafico non devono dipendere dalla
      // riuscita della fetch (le entry esistono comunque in localStorage).
      renderAll();
    }
  }

  // ---------- Calcoli ----------
  function calcRow(entry) {
    const costoMedio = entry.spent / entry.qty;
    const valoreAttuale = livePriceEur ? entry.qty * livePriceEur : null;
    const pnl = valoreAttuale !== null ? valoreAttuale - entry.spent : null;
    const pnlPct = valoreAttuale !== null ? (pnl / entry.spent) * 100 : null;
    return { costoMedio, valoreAttuale, pnl, pnlPct };
  }

  function calcTotals() {
    let totQty = 0,
      totSpent = 0,
      totDeposito = 0,
      totRestaking = 0;
    entries.forEach((e) => {
      totQty += e.qty;
      totSpent += e.spent;
      if (e.type === "deposito") totDeposito += e.qty;
      else totRestaking += e.qty;
    });
    const totValore = livePriceEur ? totQty * livePriceEur : null;
    const totPnl = totValore !== null ? totValore - totSpent : null;
    return { totQty, totSpent, totDeposito, totRestaking, totValore, totPnl };
  }

  // ---------- Render Totali ----------
  function renderTotals() {
    const box = document.getElementById("totalsRow");
    if (!box) return;
    const t = calcTotals();

    const pnlClass =
      t.totPnl === null ? "" : t.totPnl >= 0 ? "val-green" : "val-red";
    const valoreStr = t.totValore === null ? "—" : fmtEur(t.totValore);
    const pnlStr =
      t.totPnl === null ? "—" : (t.totPnl >= 0 ? "+" : "") + fmtEur(t.totPnl);

    box.innerHTML = `
      <div class="total-card">
        <span class="label">Totale BTC</span>
        <span class="value">${t.totQty.toFixed(8)}</span>
      </div>
      <div class="total-card">
        <span class="label">Da Deposito</span>
        <span class="value">${t.totDeposito.toFixed(8)}</span>
      </div>
      <div class="total-card">
        <span class="label">Da Restaking (ATOM)</span>
        <span class="value">${t.totRestaking.toFixed(8)}</span>
      </div>
      <div class="total-card">
        <span class="label">Speso Totale</span>
        <span class="value">${fmtEur(t.totSpent)}</span>
      </div>
      <div class="total-card">
        <span class="label">Valore Attuale</span>
        <span class="value">${valoreStr}</span>
      </div>
      <div class="total-card">
        <span class="label">P&amp;L</span>
        <span class="value ${pnlClass}">${pnlStr}</span>
      </div>
    `;
  }

  // ---------- Render Tabella ----------
  function renderTable() {
    const container = document.getElementById("portfolio");
    if (!container) return;

    if (entries.length === 0) {
      container.innerHTML =
        '<p style="text-align:center; color:#9a9ca3; padding:20px 0;">Nessuna entry inserita.</p>';
      return;
    }

    const sorted = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));

    let rows = "";
    sorted.forEach((entry) => {
      const { costoMedio, valoreAttuale, pnl, pnlPct } = calcRow(entry);
      const badgeClass =
        entry.type === "deposito" ? "type-deposito" : "type-restaking";
      const badgeLabel =
        entry.type === "deposito" ? "💰 Deposito" : "🔁 Restaking";

      let valoreCell = "—";
      let varCell = "—";
      if (valoreAttuale !== null) {
        const cls = pnl >= 0 ? "val-green" : "val-red";
        valoreCell = `<span class="${cls}">${fmtEur(valoreAttuale)}</span>`;
        varCell = `<span class="${cls}">${pnl >= 0 ? "+" : ""}${pnlPct.toFixed(
          2
        )}%</span>`;
      }

      rows += `
        <tr>
          <td>${new Date(entry.date).toLocaleDateString("it-IT")}</td>
          <td><span class="type-badge ${badgeClass}">${badgeLabel}</span></td>
          <td>${entry.qty.toFixed(8)}</td>
          <td>${fmtEur(entry.spent)}</td>
          <td>${fmtEur(costoMedio)}</td>
          <td>${valoreCell}</td>
          <td>${varCell}</td>
          <td>${entry.note ? entry.note : "—"}</td>
          <td>
            <button class="btn-del" data-id="${entry.id}" title="Rimuovi (posizione venduta)">
              🗑️
            </button>
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <table class="btc-entry-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Tipo</th>
            <th>Qty BTC</th>
            <th>Speso EUR</th>
            <th>Prezzo Carico</th>
            <th>Valore Attuale</th>
            <th>Var %</th>
            <th>Nota</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    container.querySelectorAll(".btn-del").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (
          confirm(
            "Confermi la rimozione di questa entry? Usalo quando la posizione è stata venduta/scambiata e non fa più parte del wallet."
          )
        ) {
          entries = entries.filter((e) => e.id !== id);
          saveEntries();
          renderAll();
        }
      });
    });
  }

  // ---------- Render Grafico ----------
  function renderChart() {
    const canvas = document.getElementById("btcChart");
    const wrapper = canvas ? canvas.closest(".chart-box") : null;
    if (!canvas) return;

    if (typeof Chart === "undefined") {
      // La libreria Chart.js non si è caricata (CDN bloccato, offline, ecc.)
      console.warn(
        "Chart.js non risulta caricato: verifica che lo script cdnjs.cloudflare.com/.../chart.umd.min.js non sia bloccato da adblocker/firewall/antivirus."
      );
      if (wrapper) {
        wrapper.innerHTML =
          '<p style="text-align:center; color:#ff4d6d; padding-top:140px;">⚠️ Libreria grafico non caricata. Controlla la connessione o eventuali blocchi (adblocker/antivirus) verso cdnjs.cloudflare.com.</p>';
      }
      return;
    }

    const liveCanvas = canvas;

    const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));

    const labels = [];
    const depositoData = [];
    const restakingData = [];
    const totaleData = [];

    let cumDeposito = 0;
    let cumRestaking = 0;

    sorted.forEach((e) => {
      if (e.type === "deposito") cumDeposito += e.qty;
      else cumRestaking += e.qty;

      labels.push(new Date(e.date).toLocaleDateString("it-IT"));
      depositoData.push(cumDeposito);
      restakingData.push(cumRestaking);
      totaleData.push(cumDeposito + cumRestaking);
    });

    const datasets = [
      {
        label: "Deposito (cumulato)",
        data: depositoData,
        borderColor: "#6fb1ff",
        backgroundColor: "rgba(111,177,255,.15)",
        tension: 0.25,
        fill: true,
        pointRadius: 3,
      },
      {
        label: "Restaking da ATOM (cumulato)",
        data: restakingData,
        borderColor: "#c69bff",
        backgroundColor: "rgba(198,155,255,.15)",
        tension: 0.25,
        fill: true,
        pointRadius: 3,
      },
      {
        label: "Totale BTC",
        data: totaleData,
        borderColor: "#f7931a",
        backgroundColor: "rgba(247,147,26,.10)",
        tension: 0.25,
        fill: false,
        borderWidth: 2.5,
        pointRadius: 3,
      },
    ];

    if (btcChart) {
      btcChart.data.labels = labels;
      btcChart.data.datasets.forEach((ds, i) => {
        ds.data = datasets[i].data;
      });
      btcChart.update();
      return;
    }

    btcChart = new Chart(liveCanvas.getContext("2d"), {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(8)} BTC`,
            },
          },
        },
        scales: {
          x: { ticks: { color: "#c3c3c3" }, grid: { color: "rgba(255,255,255,.05)" } },
          y: {
            ticks: {
              color: "#c3c3c3",
              callback: (v) => Number(v).toFixed(4),
            },
            grid: { color: "rgba(255,255,255,.05)" },
          },
        },
      },
    });
  }

  function renderAll() {
    renderTotals();
    renderTable();
    renderChart();
  }

  // ---------- Form ----------
  function initForm() {
    const form = document.getElementById("entryForm");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const type = document.getElementById("entryType").value;
      const qty = parseFloat(document.getElementById("qtyBtc").value);
      const spent = parseFloat(document.getElementById("spentEur").value);
      const note = document.getElementById("note").value.trim();

      if (!qty || qty <= 0 || !spent || spent <= 0) {
        alert("Inserisci quantità BTC e importo EUR validi.");
        return;
      }

      entries.push({
        id: uid(),
        type,
        qty,
        spent,
        note,
        date: new Date().toISOString(),
      });

      saveEntries();
      form.reset();
      document.getElementById("entryType").value = type;
      renderAll();
    });
  }

  // ---------- Export CSV ----------
  function initDownload() {
    const btn = document.getElementById("btnDownload_btc");
    if (!btn) return;

    btn.addEventListener("click", () => {
      if (entries.length === 0) {
        alert("Nessuna entry da esportare.");
        return;
      }

      const header = [
        "Data",
        "Tipo",
        "Quantita_BTC",
        "Speso_EUR",
        "Prezzo_Carico_EUR",
        "Prezzo_Attuale_EUR",
        "Valore_Attuale_EUR",
        "PnL_EUR",
        "Nota",
      ];

      const rows = entries.map((e) => {
        const { costoMedio, valoreAttuale, pnl } = calcRow(e);
        return [
          new Date(e.date).toLocaleDateString("it-IT"),
          e.type === "deposito" ? "Deposito" : "Restaking (ATOM)",
          e.qty.toFixed(8),
          e.spent.toFixed(2),
          costoMedio.toFixed(2),
          livePriceEur !== null ? livePriceEur.toFixed(2) : "",
          valoreAttuale !== null ? valoreAttuale.toFixed(2) : "",
          pnl !== null ? pnl.toFixed(2) : "",
          (e.note || "").replace(/,/g, ";"),
        ].join(",");
      });

      const csv = [header.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wallet_btc_report_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", () => {
    initForm();
    initDownload();
    renderAll();
    fetchLivePrice();
    setInterval(fetchLivePrice, PRICE_REFRESH_MS);
  });
})();