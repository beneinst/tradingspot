<script>
(function() { // IIFE per isolare lo scope e non rompere trade.js

  // ============================================
  // 1. CONFIGURAZIONE E STATO
  // ============================================
  const datiCapitale = {
    totaleIn: 0,
    capitale: 0,
    totaleTrade: 30,
    quotaPerTrade: 0,
    storicoCapitale: [],
    ultimoAggiornamento: new Date().toISOString()
  };

  // Istanze dei grafici (locali a questo modulo)
  let chartIstogramma = null; // Ex capitaleChart
  let chartStorico = null;    // Ex storicoCapitaleChart
  let chartPerc = null;       // Ex percentualeCapitaleChart
  
  let periodoVisualizzato = 30; // default: 30 giorni

  // Configurazione colori (Web vs Export)
  const coloriConfig = {
    web: { testo: '#c3c3c3', griglia: 'rgba(68, 68, 68, 0.8)' },
    export: { testo: '#000', griglia: 'rgba(200, 200, 200, 0.8)' }
  };
  let isExporting = false;

  // ============================================
  // 2. FUNZIONI CORE (Init & Update)
  // ============================================
  
  function inizializza() {
    caricaDatiLocali();
    
    // Se storico vuoto, inizializzalo
    if (!datiCapitale.storicoCapitale || datiCapitale.storicoCapitale.length === 0) {
      creaStoricoIniziale();
    }
    
    // Sincronizza subito con i trade reali
    sincronizzaTradeAttivi();

    aggiornaInterfaccia();
    
    // Crea i grafici solo se esistono i canvas nella pagina
    if(document.getElementById('capitaleChart')) creaGraficoIstogramma();
    if(document.getElementById('storicoCapitaleChart')) creaGraficoStorico();
    if(document.getElementById('percentualeCapitaleChart')) creaGraficoPercentuale();
    
    calcolaStatistichePercentuali();
  }

  function caricaDatiLocali() {
    const salvati = localStorage.getItem('datiCapitale');
    if (salvati) {
      try {
        const parsed = JSON.parse(salvati);
        Object.assign(datiCapitale, parsed);
      } catch(e) { console.error("Errore lettura datiCapitale", e); }
    }
  }

  function salvaDatiLocali() {
    localStorage.setItem('datiCapitale', JSON.stringify(datiCapitale));
  }

  function creaStoricoIniziale() {
    const oggi = new Date();
    const inizio = new Date(oggi);
    inizio.setDate(oggi.getDate() - 120);
    
    datiCapitale.storicoCapitale = [];
    for (let d = new Date(inizio); d <= oggi; d.setDate(d.getDate() + 3)) {
      datiCapitale.storicoCapitale.push({
        data: new Date(d).toISOString(),
        totaleIn: 0,
        capitale: datiCapitale.totaleTrade
      });
    }
  }

  // Sincronizza contatore "Totale In" con i trade effettivi nel LocalStorage
  function sincronizzaTradeAttivi() {
    const trades = JSON.parse(localStorage.getItem('singleTrades') || '[]');
    const count = trades.length;
    
    // Aggiorna solo se c'è differenza
    if(datiCapitale.totaleIn !== count) {
        datiCapitale.totaleIn = count;
        datiCapitale.capitale = datiCapitale.totaleTrade - count;
        salvaStorico(); // Registra il cambio nello storico
        salvaDatiLocali();
    }
  }

  function salvaStorico() {
    const oggiString = new Date().toISOString().split('T')[0];
    const recordOggi = datiCapitale.storicoCapitale.find(r => r.data.split('T')[0] === oggiString);

    if (recordOggi) {
      recordOggi.totaleIn = datiCapitale.totaleIn;
      recordOggi.capitale = datiCapitale.capitale;
    } else {
      datiCapitale.storicoCapitale.push({
        data: new Date().toISOString(),
        totaleIn: datiCapitale.totaleIn,
        capitale: datiCapitale.capitale
      });
    }
    // Tieni ordinato
    datiCapitale.storicoCapitale.sort((a, b) => new Date(a.data) - new Date(b.data));
  }

  function aggiornaInterfaccia() {
    // Aggiorna DOM elementi se esistono
    setTxt('totaleIn', datiCapitale.totaleIn);
    setTxt('capitale', datiCapitale.capitale);
    
    // Aggiorna valori input se esistono
    setVal('quotaPerTrade', datiCapitale.quotaPerTrade);
    setVal('inputTotaleIn', datiCapitale.totaleIn); // Nascosto ma utile

    // Calcoli monetari
    const q = datiCapitale.quotaPerTrade;
    setTxt('capitaleTotale', (datiCapitale.totaleTrade * q).toFixed(2));
    setTxt('capitaleInDollari', '$' + (datiCapitale.capitale * q).toFixed(2));
    setTxt('totaleInDollari', '$' + (datiCapitale.totaleIn * q).toFixed(2));
  }

  // Helper per aggiornare testo in sicurezza
  function setTxt(id, val) {
    const el = document.getElementById(id);
    if(el) el.innerText = val;
  }
  function setVal(id, val) {
    const el = document.getElementById(id);
    if(el) el.value = val;
  }

  // ============================================
  // 3. GRAFICI (Chart.js)
  // ============================================

  // --- GRAFICO 1: ISTOGRAMMA BARRA (Destra) ---
  function creaGraficoIstogramma() {
    const ctx = document.getElementById('capitaleChart');
    if(!ctx) return;

    if (chartIstogramma) chartIstogramma.destroy();

    chartIstogramma = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Allocazione'],
        datasets: [
          {
            label: 'Crypto (Investito)',
            data: [datiCapitale.totaleIn],
            backgroundColor: '#8854d0', // Viola
            barPercentage: 0.9,
            categoryPercentage: 1.0,
            borderRadius: {topLeft:10, bottomLeft:10}
          },
          {
            label: 'USD (Liquido)',
            data: [datiCapitale.capitale],
            backgroundColor: '#20bf6b', // Verde
            barPercentage: 0.9,
            categoryPercentage: 1.0,
            borderRadius: {topRight:10, bottomRight:10}
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: '#ccc' } }
        },
        scales: {
          x: { stacked: true, max: datiCapitale.totaleTrade, grid: { color: '#444' } },
          y: { stacked: true, display: false }
        }
      }
    });
  }

  // --- GRAFICO 2: STORICO (Linee) ---
  function creaGraficoStorico() {
    const ctx = document.getElementById('storicoCapitaleChart');
    if(!ctx) return;

    if (chartStorico) chartStorico.destroy();

    const datiFiltrati = filtraDati(datiCapitale.storicoCapitale, periodoVisualizzato);
    const conf = isExporting ? coloriConfig.export : coloriConfig.web;

    chartStorico = new Chart(ctx, {
      type: 'line',
      data: {
        labels: datiFiltrati.map(i => new Date(i.data).toLocaleDateString()),
        datasets: [
          {
            label: 'Investito (Crypto)',
            data: datiFiltrati.map(i => i.totaleIn),
            borderColor: '#8854d0',
            backgroundColor: 'rgba(136, 84, 208, 0.1)',
            borderWidth: 3,
            tension: 0.3,
            pointRadius: 0,
            fill: true
          },
          {
            label: 'Liquidità (USD)',
            data: datiFiltrati.map(i => i.capitale),
            borderColor: '#20bf6b',
            borderWidth: 3,
            tension: 0.3,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { labels: { color: conf.testo } }
        },
        scales: {
          y: { 
              beginAtZero: true, 
              max: datiCapitale.totaleTrade,
              grid: { color: conf.griglia },
              ticks: { color: conf.testo }
          },
          x: { 
              grid: { color: conf.griglia },
              ticks: { color: conf.testo, maxTicksLimit: 10 }
          }
        }
      }
    });
  }

  // --- GRAFICO 3: PERCENTUALE (Area) ---
  function creaGraficoPercentuale() {
    const ctx = document.getElementById('percentualeCapitaleChart');
    if(!ctx) return;

    if (chartPerc) chartPerc.destroy();

    const datiFiltrati = filtraDati(datiCapitale.storicoCapitale, periodoVisualizzato);
    const maxVal = datiCapitale.totaleTrade * datiCapitale.quotaPerTrade || 1; // Evita div by zero

    const percentuali = datiFiltrati.map(item => {
        const valUSD = item.totaleIn * datiCapitale.quotaPerTrade;
        return (valUSD / maxVal) * 100;
    });

    chartPerc = new Chart(ctx, {
      type: 'line',
      data: {
        labels: datiFiltrati.map(i => new Date(i.data).toLocaleDateString()),
        datasets: [{
          label: '% Capitale Investito',
          data: percentuali,
          borderColor: '#3BB9FF',
          backgroundColor: 'rgba(59, 185, 255, 0.2)',
          fill: true,
          tension: 0.4,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
            y: { min: 0, max: 100, ticks: { color: '#ccc'} },
            x: { ticks: { color: '#ccc', maxTicksLimit: 10 } }
        }
      }
    });
  }

  // Helper Filtro Date
  function filtraDati(arr, giorni) {
    if(!arr) return [];
    if(giorni === 'all') return arr;
    
    const limite = new Date();
    limite.setDate(limite.getDate() - parseInt(giorni));
    return arr.filter(i => new Date(i.data) >= limite);
  }

  // ============================================
  // 4. GESTIONE EVENTI (Globali per HTML)
  // ============================================

  // Esponiamo queste funzioni globalmente (window) così i bottoni HTML onclick="..." funzionano
  window.cambiaRangeTempo = function(btn) {
    // UI Update
    document.querySelectorAll('.ts-time-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Logic Update
    periodoVisualizzato = btn.dataset.days;
    creaGraficoStorico();
    creaGraficoPercentuale();
    calcolaStatistichePercentuali();
  };
  
  window.scaricaGrafico = function() {
    isExporting = true;
    const chartBox = document.getElementById('storicoCapitaleChart');
    // Ricrea ad alta risoluzione o modifica canvas... 
    // Per semplicità qui usiamo toDataURL diretto del canvas esistente
    const link = document.createElement('a');
    link.download = 'storico-capitale.png';
    link.href = chartBox.toDataURL('image/png', 1.0);
    link.click();
    isExporting = false;
  };
  
  window.calcolaStatistichePercentuali = function() {
     const dati = filtraDati(datiCapitale.storicoCapitale, periodoVisualizzato);
     let c0=0, c25=0, c50=0, c75=0;
     
     const max = datiCapitale.totaleTrade * datiCapitale.quotaPerTrade || 1;
     
     dati.forEach(i => {
         const val = (i.totaleIn * datiCapitale.quotaPerTrade / max) * 100;
         if(val <= 25) c0++;
         else if(val <= 50) c25++;
         else if(val <= 75) c50++;
         else c75++;
     });
     
     setTxt('percentuale0_25', c0 + ' gg');
     setTxt('percentuale25_50', c25 + ' gg');
     setTxt('percentuale50_75', c50 + ' gg');
     setTxt('percentuale75_100', c75 + ' gg');
  };
  
  // Funzione per aggiornare il capitale manualmente dall'input
  window.aggiornaCapitale = function() {
      const input = document.getElementById('quotaPerTrade');
      if(input) {
          datiCapitale.quotaPerTrade = parseFloat(input.value) || 0;
          salvaDatiLocali();
          aggiornaInterfaccia();
          // Ridisegna grafici che dipendono dai $
          creaGraficoPercentuale();
          calcolaStatistichePercentuali();
      }
  }

  // ============================================
  // 5. STARTUP
  // ============================================
  
  // Init all'avvio
  document.addEventListener('DOMContentLoaded', inizializza);

  // Ascolta eventi da altre pagine (es. trade.js che aggiunge un trade)
  window.addEventListener('storage', (e) => {
    if(e.key === 'singleTrades' || e.key === '__tradeEvent__') {
        sincronizzaTradeAttivi();
        aggiornaInterfaccia();
        creaGraficoIstogramma();
        creaGraficoStorico();
        creaGraficoPercentuale();
    }
  });

})(); // Fine IIFE
</script>