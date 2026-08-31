/* ==========================================================
   Wallet USDC - FlowChart
   - Prezzo USDC live in EUR (CoinGecko, prezzo diretto)
   - Gestione entry: Deposito (unico tipo)
   - Tabella con colore rosso/verde su prezzo di carico
   - Grafico cumulato (totale USDC)
   - Cancellazione entry (posizione venduta/uscita dal wallet)
   - Export CSV
   ========================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "usdcWalletEntries";
  const PRICE_REFRESH_MS = 30000; // 30s
  // CoinGecko fornisce già il prezzo diretto in EUR: evita una seconda
  // chiamata a frankfurter.app, che blocca via CORS se la pagina è aperta
  // come file locale (origin "null") invece che da un server/GitHub Pages.
  const COINGECKO_URL =
    "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=eur";

  let entries = loadEntries();
  let livePriceEur = null;
  let usdcChart = null;

  // ---------- Storage ----------
  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Errore lettura storage USDC:", e);
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
    const priceEl = document.getElementById("usdcLivePrice");
    const updatedEl = document.getElementById("priceUpdated");

    try {
      const res = await fetch(COINGECKO_URL);
      if (!res.ok) throw new Error("Risposta non valida da CoinGecko");

      const data = await res.json();
      const priceEur = data && data["usd-coin"] && data["usd-coin"].eur;
      if (!priceEur) throw new Error("Prezzo non trovato nella risposta");

      livePriceEur = priceEur;
      priceEl.textContent = fmtEur(livePriceEur);
      updatedEl.textContent =
        "aggiornato alle " + new Date().toLocaleTimeString("it-IT");
      if (dot) dot.style.background = "#3ddc84";
    } catch (err) {
      console.error("Errore fetch prezzo USDC:", err);
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
      totSpent = 0;
    entries.forEach((e) => {
      totQty += e.qty;
      totSpent += e.spent;
    });
    const totValore = livePriceEur ? totQty * livePriceEur : null;
    const totPnl = totValore !== null ? totValore - totSpent : null;
    return { totQty, totSpent, totValore, totPnl };
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
        <span class="label">Totale USDC</span>
        <span class="value">${t.totQty.toFixed(8)}</span>
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
          <td>${entry.qty.toFixed(8)}</td>
          <td>${fmtEur(entry.spent)}</td>
          <td>${fmtEur(costoMedio)}</td>
          <td>${valoreCell}</td>
          <td>${varCell}</td>
          <td>${entry.note ? entry.note : "—"}</td>
          <td>
            <button class="btn-del" data-id="${entry.id}" data-action="edit" title="Modifica">
              ✏️
            </button>
            <button class="btn-del" data-id="${entry.id}" data-action="delete" title="Rimuovi (posizione venduta)">
              🗑️
            </button>
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <table class="usdc-entry-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Qty USDC</th>
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

    container.querySelectorAll('.btn-del[data-action="delete"]').forEach((btn) => {
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

    container.querySelectorAll('.btn-del[data-action="edit"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        openEditModal(btn.getAttribute("data-id"));
      });
    });
  }

  /* ==========================================================
     EDITING COMPLETO (data, quantità USDC, speso EUR, nota) —
     vale per tutte le entry, manuali o auto-importate dalla
     sincronizzazione blockchain.
     ========================================================== */
  function openEditModal(id) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    const dateVal = new Date(entry.date).toISOString().slice(0, 10);

    const overlay = document.createElement("div");
    overlay.id = "editUsdcModalOverlay";
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;";
    overlay.innerHTML = `
      <div style="background:#1b1b2f;border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:24px;width:min(420px,90vw);box-shadow:0 10px 40px rgba(0,0,0,0.6);">
        <h3 style="color:#F2BB66;margin-bottom:16px;">✏️ Modifica entry USDC</h3>

        <label style="display:block;color:#F2BB66;font-size:0.85em;margin-bottom:4px;">Data</label>
        <input type="date" id="editUsdcDate" value="${dateVal}" style="width:100%;padding:8px 10px;margin-bottom:12px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(35,35,59,0.6);color:#e0e0e0;">

        <label style="display:block;color:#F2BB66;font-size:0.85em;margin-bottom:4px;">Quantità USDC</label>
        <input type="number" step="any" id="editUsdcQty" value="${entry.qty}" style="width:100%;padding:8px 10px;margin-bottom:12px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(35,35,59,0.6);color:#e0e0e0;">

        <label style="display:block;color:#F2BB66;font-size:0.85em;margin-bottom:4px;">Speso EUR</label>
        <input type="number" step="any" id="editUsdcSpent" value="${entry.spent}" style="width:100%;padding:8px 10px;margin-bottom:12px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(35,35,59,0.6);color:#e0e0e0;">

        <label style="display:block;color:#F2BB66;font-size:0.85em;margin-bottom:4px;">Nota</label>
        <input type="text" id="editUsdcNote" value="${(entry.note || "").replace(/"/g, "&quot;")}" style="width:100%;padding:8px 10px;margin-bottom:16px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(35,35,59,0.6);color:#e0e0e0;">

        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="btn-del" onclick="document.getElementById('editUsdcModalOverlay').remove();">Annulla</button>
          <button class="btn-del" id="saveUsdcEditBtn" style="background:linear-gradient(135deg,#4a90e2,#667eea);">💾 Salva</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById("saveUsdcEditBtn").addEventListener("click", () => {
      const date = document.getElementById("editUsdcDate").value;
      const qty = parseFloat(document.getElementById("editUsdcQty").value);
      const spent = parseFloat(document.getElementById("editUsdcSpent").value);
      const note = document.getElementById("editUsdcNote").value;

      if (!date || isNaN(qty) || qty <= 0 || isNaN(spent) || spent < 0) {
        alert("⚠️ Data, quantità o importo non validi");
        return;
      }

      entry.date = new Date(date).toISOString();
      entry.qty = qty;
      entry.spent = spent;
      entry.note = note;

      saveEntries();
      overlay.remove();
      renderAll();
    });
  }

  // ---------- Render Grafico ----------
  function renderChart() {
    const canvas = document.getElementById("usdcChart");
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
    const totaleData = [];

    let cumTotale = 0;

    sorted.forEach((e) => {
      cumTotale += e.qty;
      labels.push(new Date(e.date).toLocaleDateString("it-IT"));
      totaleData.push(cumTotale);
    });

    const datasets = [
      {
        label: "Totale USDC",
        data: totaleData,
        borderColor: "#2775ca",
        backgroundColor: "rgba(39,117,202,.15)",
        tension: 0.25,
        fill: true,
        borderWidth: 2.5,
        pointRadius: 3,
      },
    ];

    if (usdcChart) {
      usdcChart.data.labels = labels;
      usdcChart.data.datasets.forEach((ds, i) => {
        ds.data = datasets[i].data;
      });
      usdcChart.update();
      return;
    }

    usdcChart = new Chart(liveCanvas.getContext("2d"), {
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
                `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(8)} USDC`,
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

      const qty = parseFloat(document.getElementById("qtyUsdc").value);
      const spent = parseFloat(document.getElementById("spentEur").value);
      const note = document.getElementById("note").value.trim();

      if (!qty || qty <= 0 || !spent || spent <= 0) {
        alert("Inserisci quantità USDC e importo EUR validi.");
        return;
      }

      entries.push({
        id: uid(),
        qty,
        spent,
        note,
        date: new Date().toISOString(),
      });

      saveEntries();
      form.reset();
      renderAll();
    });
  }

  // ---------- Export CSV ----------
  function initDownload() {
    const btn = document.getElementById("btnDownload_usdc");
    if (!btn) return;

    btn.addEventListener("click", () => {
      if (entries.length === 0) {
        alert("Nessuna entry da esportare.");
        return;
      }

      const header = [
        "Data",
        "Quantita_USDC",
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
      a.download = `wallet_usdc_report_${new Date()
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