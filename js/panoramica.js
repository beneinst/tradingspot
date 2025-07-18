// Dati principali dell'applicazione
  const datiCapitale = {
  totaleIn: 0,
  capitale: 0,
  totaleTrade: 30,
  quotaPerTrade: 0,
  storicoCapitale: [],
  ultimoAggiornamento: new Date().toISOString()

};

  
  // Variabili per i grafici
  let capitaleChart = null;
  let storicoCapitaleChart = null;
  let percentualeCapitaleChart = null;
  let periodoVisualizzato = 30; // default: 30 giorni
  
  // Funzione di inizializzazione
  function inizializza() {
    // Carica dati salvati se disponibili
    caricaDatiLocali();
    
    // Se non ci sono dati storici, crea un punto iniziale
    if (datiCapitale.storicoCapitale.length === 0) {
      creaStoricoIniziale();
    }
    
    // Aggiorna l'interfaccia con i dati attuali
    aggiornaInterfaccia();
    
    // Crea il grafico iniziale
    creaGraficoCapitale();
    
    // Crea il grafico storico
    creaGraficoStoricoCapitale();
    
    // Crea il grafico percentuale
    creaGraficoPercentualeCapitale();
    
    // Calcola e mostra le statistiche sulla percentuale di tempo
    calcolaStatistichePercentuali();
  }
  
  // Crea uno storico iniziale con valori di default retroattivi
  function creaStoricoIniziale() {
    const oggi = new Date();
    const inizioStorico = new Date(oggi);
    inizioStorico.setDate(oggi.getDate() - 120); // Crea uno storico di 4 mesi
    
    // Valori di default per lo storico iniziale
   const valoriDefault = {
  totaleIn: 0,
  capitale: datiCapitale.totaleTrade
};

for (let d = new Date(inizioStorico); d <= oggi; d.setDate(d.getDate() + 3)) {
  datiCapitale.storicoCapitale.push({
    data: new Date(d).toISOString(),
    totaleIn: valoriDefault.totaleIn,
    capitale: valoriDefault.capitale
  });
}

datiCapitale.storicoCapitale.push({
  data: new Date().toISOString(),
  totaleIn: datiCapitale.totaleIn,
  capitale: datiCapitale.capitale
});
}
  
  // Aggiorna i totali
  function aggiornaTotali() {
    datiCapitale.quotaPerTrade = parseFloat(document.getElementById("quotaPerTrade").value) || datiCapitale.quotaPerTrade;
    
    // Aggiorna l'interfaccia
    aggiornaInterfaccia();
    
    // Salva lo stato nei dati storici
    salvaStorico();
    
    // Salva i dati in localStorage
    salvaDatiLocali();
    
    // Aggiorna i grafici
   // aggiornaGrafico();
    aggiornaGraficoStorico();
    aggiornaGraficoPercentuale();
    
    // Ricalcola le statistiche percentuali
    calcolaStatistichePercentuali();
  }
  
  // Funzione per resettare tutti i dati
function resettaDati() {
  datiCapitale.totaleIn = 0;
  datiCapitale.capitale = datiCapitale.totaleTrade;
  datiCapitale.storicoCapitale = [];
  datiCapitale.ultimoAggiornamento = new Date().toISOString();

  creaStoricoIniziale();
  aggiornaInterfaccia();
  aggiornaGraficoStorico();
  aggiornaGraficoPercentuale();
  calcolaStatistichePercentuali();
  salvaDatiLocali();

  alert('Dati resettati con successo!');
}


// Salva immagine del grafico
function scaricaGrafico() {
  const canvas = document.getElementById('storicoCapitaleChart');
  
  // Attiva modalità export e ricrea il grafico
  modalitaExport = true;
  creaGraficoStoricoCapitale();
  
  // Aspetta che il grafico sia completamente renderizzato
  setTimeout(() => {
    // Crea un canvas temporaneo con proporzioni più ampie (16:9)
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // Imposta dimensioni HD con rapporto 16:9
    tempCanvas.width = 4260;
    tempCanvas.height = 2160;
    
    // Riempie lo sfondo di BIANCO
    tempCtx.fillStyle = '#FFFFFF';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Copia il grafico originale sul canvas temporaneo
    tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
    
    // Aggiungi il watermark
    aggiungiWatermark(tempCtx, tempCanvas.width, tempCanvas.height);
    
    // Crea il link per il download
    const link = document.createElement('a');
    const oggi = new Date();
    const dataFormattata = oggi.toISOString().split('T')[0];
    
    link.download = `grafico-capitale-HD-${dataFormattata}.png`;
    link.href = tempCanvas.toDataURL('image/png', 1.0);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Disattiva modalità export e ricrea il grafico per la visualizzazione web
    modalitaExport = false;
    creaGraficoStoricoCapitale();
  }, 100); // Piccolo delay per assicurarsi che il rendering sia completo
}


  
 // 2. Modifica la funzione aggiornaTrade() 
function aggiornaTrade() {
    const nuovoTotaleIn = parseInt(document.getElementById("inputTotaleIn").value);
    
    if (!isNaN(nuovoTotaleIn)) {
      datiCapitale.totaleIn = nuovoTotaleIn;
      
    }
    
    // Aggiorna il capitale disponibile
    calcolaCapitale();
    
    // Aggiorna l'ultimo aggiornamento
    datiCapitale.ultimoAggiornamento = new Date().toISOString();
    
    // Aggiorna l'interfaccia
    aggiornaInterfaccia();
    
    // Salva lo stato nei dati storici
    salvaStorico();
    
    // Salva i dati in localStorage
    salvaDatiLocali();
    
    // Aggiorna i grafici
    aggiornaGraficoStorico();
    aggiornaGraficoPercentuale();
    
    // Ricalcola le statistiche percentuali
    calcolaStatistichePercentuali();
    
    setTimeout(() => {
      salvaDatiLocali();
      aggiornaGraficoStorico();
    }, 100);
}


  // Calcola il capitale disponibile
  function calcolaCapitale() {
    datiCapitale.capitale = datiCapitale.totaleTrade - datiCapitale.totaleIn;
  }
  
  function verificaDatiStorico() {
  console.log('Dati storico attuali:', datiCapitale.storicoCapitale);
  console.log('Ultimo aggiornamento:', datiCapitale.ultimoAggiornamento);
  console.log('LocalStorage:', JSON.parse(localStorage.getItem('datiCapitale')));
}

 // 1. Modifica la funzione aggiornaInterfaccia()
function aggiornaInterfaccia() {
    document.getElementById("totaleIn").textContent = datiCapitale.totaleIn;
    document.getElementById("capitale").textContent = datiCapitale.capitale;
    document.getElementById("totaleTrade").textContent = datiCapitale.totaleTrade;
    document.getElementById("infoTotaleTrade").textContent = datiCapitale.totaleTrade;
    document.getElementById("quotaPerTrade").value = datiCapitale.quotaPerTrade;
    
    // Aggiorna il valore dell'input (ora solo uno)
    document.getElementById("inputTotaleIn").value = datiCapitale.totaleIn;
    
    // Calcola e aggiorna i nuovi valori in dollari
    const capitaleTotale = datiCapitale.totaleTrade * datiCapitale.quotaPerTrade;
    const capitaleInDollari = datiCapitale.capitale * datiCapitale.quotaPerTrade;
    const totaleInDollari = datiCapitale.totaleIn * datiCapitale.quotaPerTrade;
    
    // Aggiorna i nuovi elementi dell'interfaccia
    document.getElementById('capitaleTotale').innerText = capitaleTotale;
    document.getElementById('capitaleInDollari').innerText = `$${capitaleInDollari}`;
    document.getElementById('totaleInDollari').innerText = `$${totaleInDollari}`;
    
    // Calcola e aggiorna le medie (modificato per il totale unico)
    const datiPeriodo = filtraDatiPerPeriodo(datiCapitale.storicoCapitale, periodoVisualizzato);
    
    if (datiPeriodo.length > 0) {
      const mediaTotaleIn = calcolaMedia(datiPeriodo.map(item => item.totaleIn));
      const mediaDollari = mediaTotaleIn * datiCapitale.quotaPerTrade;
      
      document.getElementById("mediaTradeTotaleIn").textContent = mediaTotaleIn.toFixed(1);
      document.getElementById("mediaDollariTrading").textContent = `$${mediaDollari.toFixed(2)}`;
    }
}

  
  // Calcola la media di un array di numeri
  function calcolaMedia(array) {
    if (array.length === 0) return 0;
    return array.reduce((sum, val) => sum + val, 0) / array.length;
  }
  
 // Salva lo stato attuale nei dati storici
 function salvaStorico() {
  const oggi = new Date();
  const oggiString = oggi.toISOString().split('T')[0];
  const recordOggi = datiCapitale.storicoCapitale.find(record => 
    record.data.split('T')[0] === oggiString
  );

  if (recordOggi) {
    // Aggiorna il record esistente per oggi
    recordOggi.totaleIn = datiCapitale.totaleIn;
    recordOggi.capitale = datiCapitale.capitale;
  } else {
    // Aggiungi un nuovo record solo se non esiste già
    datiCapitale.storicoCapitale.push({
      data: oggi.toISOString(),
      totaleIn: datiCapitale.totaleIn,
      capitale: datiCapitale.capitale
    });
}


  
  // Ordina lo storico per data
  datiCapitale.storicoCapitale.sort((a, b) => new Date(a.data) - new Date(b.data));
}
  
  // Filtra i dati storici per il periodo visualizzato
  function filtraDatiPerPeriodo(dati, giorni) {
    if (!dati || dati.length === 0) return [];
    
    if (giorni === 'all') return dati;
    
    const oggi = new Date();
    const dataLimite = new Date(oggi);
    dataLimite.setDate(oggi.getDate() - giorni);
    
    return dati.filter(item => new Date(item.data) >= dataLimite);
  }
  
 // 5. Modifica la funzione creaGraficoCapitale() per il grafico a torta
function creaGraficoCapitale() {
  const ctx = document.getElementById('capitaleChart').getContext('2d');

  if (capitaleChart) {
    capitaleChart.destroy();
  }

  capitaleChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Totale In (Crypto)', 'A Capitale (USD)'],
      datasets: [{
        data: [
          datiCapitale.totaleIn,
          datiCapitale.capitale
        ],
        backgroundColor: [
          '#F62817',
          '#1AA6ED'
        ],
        borderColor: '#222',
        borderWidth: 1,
        hoverOffset: 22
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#c3c3c3',
            font: {
              size: 15,
              family: 'Trebuchet MS'
            },
            padding: 8,
            boxWidth: 15,
            boxHeight: 15,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: '#181c23',
          titleColor: '#739bf2',
          bodyColor: '#F0F8FF',
          borderColor: '#2980b9',
          borderWidth: 2,
          cornerRadius: 10,
          padding: 18,
          displayColors: true,
          bodyFont: {
            size: 18
          },
          callbacks: {
            label: function (context) {
              const label = context.label || '';
              const value = context.raw || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              const dollari = (value * datiCapitale.quotaPerTrade).toFixed(2);
              return `${label}: ${value} trade (${percentage}%) = $${dollari}`;
            }
          }
        }
      },
      cutout: '45%',
      layout: {
        padding: 18
      }
    }
  });
}

// Funzione per scaricare il grafico percentuale
// Funzione per scaricare il grafico percentuale con dimensioni HD e sfondo bianco
function scaricaGraficoPercentuale1() {
  console.log('Funzione scaricaGraficoPercentuale chiamata'); // Debug
  
  // Verifica che la variabile del grafico esista
  if (typeof percentualeCapitaleChart === 'undefined' || !percentualeCapitaleChart) {
    console.error('Grafico percentualeCapitaleChart non trovato - assicurati che sia stato creato');
    alert('Grafico non disponibile per il download. Assicurati che il grafico sia visualizzato.');
    return;
  }
  
  try {
    // Crea un canvas temporaneo con proporzioni più ampie (16:9)
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // Imposta dimensioni HD con rapporto 16:9
    tempCanvas.width = 4260;
    tempCanvas.height = 2160;
    
    // Riempie lo sfondo di BIANCO
    tempCtx.fillStyle = '#FFFFFF';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Ottieni l'immagine del grafico originale
    const chartImageUrl = percentualeCapitaleChart.toBase64Image('image/png', 1.0);
    
    // Crea un'immagine temporanea per disegnare sul canvas
    const img = new Image();
    img.onload = function() {
      // Disegna l'immagine del grafico sul canvas temporaneo
      tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
      
      // Aggiungi il watermark se la funzione esiste
      if (typeof aggiungiWatermark === 'function') {
        aggiungiWatermark(tempCtx, tempCanvas.width, tempCanvas.height);
      }
      
      // Crea il link per il download
      const link = document.createElement('a');
      const oggi = new Date();
      const dataFormattata = oggi.toISOString().split('T')[0];
      
      link.download = `grafico-percentuale-capitale-HD-${dataFormattata}.png`;
      link.href = tempCanvas.toDataURL('image/png', 1.0);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('Download completato');
    };
    
    img.onerror = function() {
      console.error('Errore nel caricamento dell\'immagine del grafico');
      alert('Errore nel caricamento dell\'immagine del grafico');
    };
    
    // Carica l'immagine del grafico
    img.src = chartImageUrl;
    
  } catch (error) {
    console.error('Errore durante il download:', error);
    alert('Errore durante il download del grafico: ' + error.message);
  }
}
// NOTA: Nel tuo codice creaGraficoPercentualeCapitale() c'è un errore:
// Cambia "borderColor: 2," in "borderColor: '#3498db'," o un altro colore valido

// Pulsante HTML da aggiungere nella sezione del grafico percentuale
/*
<button onclick="scaricaGraficoPercentuale()" class="btn btn-secondary">
  <i class="fas fa-download"></i> Scarica Grafico Percentuale
</button>
*/

// Funzione per scaricare il grafico percentuale
function scaricaGraficoPercentuale() {
  const canvas = document.getElementById('percentualeCapitaleChart');
  
  // Attiva modalità export e ricrea il grafico
  modalitaExport = true;
  creaGraficoPercentualeCapitale();
  
  // Aspetta che il grafico sia completamente renderizzato
  setTimeout(() => {
    // Crea un canvas temporaneo con proporzioni più ampie (16:9)
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // Imposta dimensioni HD con rapporto 16:9
    tempCanvas.width = 4260;
    tempCanvas.height = 2160;
    
    // Riempie lo sfondo di BIANCO
    tempCtx.fillStyle = '#FFFFFF';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Copia il grafico originale sul canvas temporaneo
    tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
    
    // Aggiungi il watermark
    aggiungiWatermark(tempCtx, tempCanvas.width, tempCanvas.height);
    
    // Crea il link per il download
    const link = document.createElement('a');
    const oggi = new Date();
    const dataFormattata = oggi.toISOString().split('T')[0];
    
    link.download = `grafico-percentuale-capitale-HD-${dataFormattata}.png`;
    link.href = tempCanvas.toDataURL('image/png', 1.0);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Disattiva modalità export e ricrea il grafico per la visualizzazione web
    modalitaExport = false;
    creaGraficoPercentualeCapitale();
  }, 100); // Piccolo delay per assicurarsi che il rendering sia completo
}
  
  // Crea il grafico storico della distribuzione del capitale
  // Configurazione colori per web e export
const coloriConfig = {
  web: {
    testo: '#fff',
    griglia: 'rgba(68, 68, 68, 0.8)',
    sfondo: 'transparent'
  },
  export: {
    testo: '#000',
    griglia: 'rgba(200, 200, 200, 0.8)',
    sfondo: '#ffffff'
  }
};

let modalitaExport = false; // Flag per sapere se stiamo esportando

// 3. Modifica la funzione creaGraficoStoricoCapitale() per mostrare solo due linee
function creaGraficoStoricoCapitale() {
  const canvas = document.getElementById('storicoCapitaleChart');
  const ctx = canvas.getContext('2d');

  const datiPeriodo = filtraDatiPerPeriodo(datiCapitale.storicoCapitale, periodoVisualizzato);

  if (storicoCapitaleChart) {
    storicoCapitaleChart.destroy();
  }

  // Scegli i colori in base alla modalità
  const colori = modalitaExport ? coloriConfig.export : coloriConfig.web;

  storicoCapitaleChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: datiPeriodo.map(item => {
        const data = new Date(item.data);
        return `${data.getDate()}/${data.getMonth() + 1}`;
      }),
      datasets: [
        {
          label: 'Totale In (Crypto)',
          data: datiPeriodo.map(item => item.totaleIn),
          backgroundColor: 'rgba(246, 40, 23, 0.2)',
          borderColor: '#F62817',
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Capitale (USD)',
          data: datiPeriodo.map(item => item.capitale),
          backgroundColor: 'rgba(0, 128, 128, 0.2)',
          borderColor: '#1AA6ED',
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      
      interaction: {
        mode: 'index',
        intersect: false
      },
      hover: {
        mode: 'index',
        intersect: false,
        animationDuration: 300
      },
      animation: {
        duration: modalitaExport ? 0 : 800,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: colori.testo,
            font: {
              size: 14,
              family: 'Poppins, Arial, sans-serif'
            },
            padding: 15,
            boxWidth: 25,
            boxHeight: 12,
            usePointStyle: false
          }
        },
        tooltip: {
          enabled: !modalitaExport,
          backgroundColor: 'rgba(51, 51, 51, 0.95)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#666',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: function(context) {
              const label = context.dataset.label || '';
              const value = context.parsed.y || 0;
              return `${label}: ${value.toFixed(2)}`;
            }
          }
        }
      },
      layout: {
        padding: {
          top: modalitaExport ? 2 : 5,
          right: modalitaExport ? 5 : 10,
          bottom: modalitaExport ? 2 : 5,
          left: modalitaExport ? 5 : 5
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 30,
          title: {
            display: true,
            text: 'Numero di Trade',
            color: colori.testo,
            font: {
              size: modalitaExport ? 14.5 : 12
            }
          },
          ticks: {
            color: colori.testo,
            font: {
              size: modalitaExport ? 14.5 : 12
            }
          },
          grid: {
            color: colori.griglia
          }
        },
        x: {
          title: {
            display: true,
            text: 'Data',
            color: colori.testo,
            font: {
              size: modalitaExport ? 14.5 : 12
            }
          },
          ticks: {
            color: colori.testo,
            font: {
              size: modalitaExport ? 14.5 : 12
            },
            maxRotation: 45,
            minRotation: 0
          },
          grid: {
            color: colori.griglia
          }
        }
      }
    }
  });
}


// Funzione per aggiungere watermark al canvas
function aggiungiWatermark(ctx, width, height) {
  const oggi = new Date();
  const dataFormattata = oggi.toLocaleDateString('it-IT');
  
  // Salva il contesto corrente
  ctx.save();
  
  // Configura il testo del watermark
  ctx.font = '34px "Courier New", monospace';
  ctx.fillStyle = '#666666';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  
  // Testo del watermark
  const watermarkText = `📈 gerardo_dorrico data: ${dataFormattata}`;
  
  // Posiziona il watermark in basso a destra
  const padding = 30;
  ctx.fillText(watermarkText, width - padding, height - padding);
  
  // Ripristina il contesto
  ctx.restore();
}



  
 // 4. Modifica la funzione aggiornaGraficoStorico()
function aggiornaGraficoStorico() {
    if (storicoCapitaleChart) {
      const datiPeriodo = filtraDatiPerPeriodo(datiCapitale.storicoCapitale, periodoVisualizzato);
      
      storicoCapitaleChart.data.labels = datiPeriodo.map(item => {
        const data = new Date(item.data);
        return `${data.getDate()}/${data.getMonth() + 1}`;
      });
      
      // Solo due dataset ora
      storicoCapitaleChart.data.datasets[0].data = datiPeriodo.map(item => item.totaleIn);
      storicoCapitaleChart.data.datasets[1].data = datiPeriodo.map(item => item.capitale);
      
      storicoCapitaleChart.update();
    }
}


  // Cambia il range di tempo visualizzato
  function cambiaRangeTempo(elemento) {
    // Rimuovi la classe active da tutti i bottoni
    document.querySelectorAll('.time-range-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Aggiungi la classe active all'elemento cliccato
    elemento.classList.add('active');
    
    // Aggiorna il periodo visualizzato
    periodoVisualizzato = elemento.dataset.days;
    
    // Aggiorna i grafici
    aggiornaGraficoStorico();
    aggiornaGraficoPercentuale();
    
    // Aggiorna le statistiche
    aggiornaInterfaccia();
    
    // Ricalcola le statistiche percentuali
    calcolaStatistichePercentuali();
  }
  
  // Cambia tab attivo
  function cambiaTab(event, tabId) {
    // Nascondi tutti i pannelli
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    
    // Rimuovi active da tutti i bottoni
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Mostra il pannello selezionato
    document.getElementById(tabId).classList.add('active');
    
    // Attiva il bottone cliccato
    event.currentTarget.classList.add('active');
    
    // Aggiorna i grafici se necessario
    if (tabId === 'tab-distribuzione') {
      aggiornaGraficoStorico();
    } else if (tabId === 'tab-percentuale') {
      aggiornaGraficoPercentuale();
      calcolaStatistichePercentuali();
    }
  }
  
  // Crea il grafico percentuale
  function creaGraficoPercentualeCapitale() {
    const ctx = document.getElementById('percentualeCapitaleChart').getContext('2d');
    const datiPeriodo = filtraDatiPerPeriodo(datiCapitale.storicoCapitale, periodoVisualizzato);
    
    // Calcola le percentuali del capitale in dollari
    const percentuali = datiPeriodo.map(item => {
      const totaleInDollari = item.totaleIn * datiCapitale.quotaPerTrade;
      const totaleComplessivo = datiCapitale.totaleTrade * datiCapitale.quotaPerTrade;
      return (totaleInDollari / totaleComplessivo) * 100;
    });
    
    percentualeCapitaleChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: datiPeriodo.map(item => {
          const data = new Date(item.data);
          return `${data.getDate()}/${data.getMonth() + 1}`;
        }),
        datasets: [{
          label: '% Capitale in Trading',
          data: percentuali,
          backgroundColor: 'rgba(213, 240, 255, 0.4)',
          borderColor: 'rgba(0,65,194, 1)',
          tension: 0.4,
          fill: true,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Percentuale in Trading (%)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Data'
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.raw || 0;
                return `Capitale in Trading: ${value.toFixed(1)}%`;
              }
            }
          }
        }
      }
    });
  }
  
  // Aggiorna il grafico percentuale
  function aggiornaGraficoPercentuale() {
    if (percentualeCapitaleChart) {
      const datiPeriodo = filtraDatiPerPeriodo(datiCapitale.storicoCapitale, periodoVisualizzato);
      
      // Aggiorna le etichette
      percentualeCapitaleChart.data.labels = datiPeriodo.map(item => {
        const data = new Date(item.data);
        return `${data.getDate()}/${data.getMonth() + 1}`;
      });
      
      // Calcola le nuove percentuali
      const percentuali = datiPeriodo.map(item => {
        const totaleInDollari = item.totaleIn * datiCapitale.quotaPerTrade;
        const totaleComplessivo = datiCapitale.totaleTrade * datiCapitale.quotaPerTrade;
        return (totaleInDollari / totaleComplessivo) * 100;
      });
      
      percentualeCapitaleChart.data.datasets[0].data = percentuali;
      percentualeCapitaleChart.update();
    }
  }
  
  // Calcola le statistiche per le percentuali di tempo
  function calcolaStatistichePercentuali() {
    const datiPeriodo = filtraDatiPerPeriodo(datiCapitale.storicoCapitale, periodoVisualizzato);
    
    if (datiPeriodo.length === 0) {
      return;
    }
    
    // Contatori per ciascuna fascia percentuale
    let count0_25 = 0;
    let count25_50 = 0;
    let count50_75 = 0;
    let count75_100 = 0;
    
    // Calcola le percentuali per ogni giorno e incrementa i contatori
    datiPeriodo.forEach(item => {
      const totaleInDollari = item.totaleIn * datiCapitale.quotaPerTrade;
      const totaleComplessivo = datiCapitale.totaleTrade * datiCapitale.quotaPerTrade;
      const percentuale = (totaleInDollari / totaleComplessivo) * 100;
      
      if (percentuale <= 25) {
        count0_25++;
      } else if (percentuale <= 50) {
        count25_50++;
      } else if (percentuale <= 75) {
        count50_75++;
      } else {
        count75_100++;
      }
    });
    
    // Aggiorna i contatori nell'interfaccia
    document.getElementById("percentuale0_25").textContent = `${count0_25} giorni`;
    document.getElementById("percentuale25_50").textContent = `${count25_50} giorni`;
    document.getElementById("percentuale50_75").textContent = `${count50_75} giorni`;
    document.getElementById("percentuale75_100").textContent = `${count75_100} giorni`;
  }
  
	// Totale del Capitale
   function aggiornaCapitale() {
    // Recupera il valore dei "Trade Totali"
    const tradeTotali = parseInt(document.getElementById('totaleTrade').innerText);

    // Recupera il valore della "Quota per Trade"
    const quotaPerTrade = parseInt(document.getElementById('quotaPerTrade').value);

    // Salva il valore quotaPerTrade nei dati principali
    datiCapitale.quotaPerTrade = quotaPerTrade;

    // Calcola il "Capitale Totale"
    const capitaleTotale = tradeTotali * quotaPerTrade;

    // Calcola "A Capitale" in dollari
    const capitaleInDollari = datiCapitale.capitale * quotaPerTrade;

    // Calcola "Totale In" in dollari
    const totaleInDollari = datiCapitale.totaleIn * quotaPerTrade;

    // Aggiorna tutti i valori nell'interfaccia
    document.getElementById('capitaleTotale').innerText = capitaleTotale;
    document.getElementById('capitaleInDollari').innerText = `$${capitaleInDollari}`;
    document.getElementById('totaleInDollari').innerText = `$${totaleInDollari}`;

    // Salva i dati aggiornati
    salvaDatiLocali();
}



// Modifica la funzione aggiornaTotali() per salvare quotaPerTrade
function aggiornaTotali() {
    datiCapitale.quotaPerTrade = parseFloat(document.getElementById("quotaPerTrade").value) || datiCapitale.quotaPerTrade;
    
    // Aggiorna l'interfaccia
    aggiornaInterfaccia();
    
    // Salva lo stato nei dati storici
    salvaStorico();
    
    // Salva i dati in localStorage
    salvaDatiLocali();
    
    // Aggiorna i grafici
   // aggiornaGrafico();
    aggiornaGraficoStorico();
    aggiornaGraficoPercentuale();
    
    // Ricalcola le statistiche percentuali
    calcolaStatistichePercentuali();
}


  // Salva i dati in localStorage
  function salvaDatiLocali() {
    localStorage.setItem('datiCapitale', JSON.stringify(datiCapitale));
  }
  
  // Carica i dati da localStorage
  function caricaDatiLocali() {
  const datiSalvati = localStorage.getItem('datiCapitale');
  if (datiSalvati) {
    const datiCaricati = JSON.parse(datiSalvati);
    if (!datiCaricati.hasOwnProperty('totaleIn') || !datiCaricati.hasOwnProperty('capitale')) {
      alert('Il file non contiene dati validi.');
      return;
    }
    Object.assign(datiCapitale, datiCaricati);
  }
}


  
  // Scarica i dati come file JSON
  function scaricaDati() {
    const dataStr = JSON.stringify(datiCapitale, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const a = document.createElement('a');
    a.href = url;
	
    a.download = `capitale-trading-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  // Carica i dati da un file JSON
  function caricaDati() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
      alert('Seleziona un file JSON prima di procedere.');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const datiCaricati = JSON.parse(e.target.result);
        
        // Verifica che i dati caricati abbiano la struttura corretta
        if (!datiCaricati.hasOwnProperty('totaleIn') || 
            !datiCaricati.hasOwnProperty('capitale')) {
          alert('Il file non contiene dati validi.');
          return;
        }
        
        // Aggiorna i dati dell'applicazione
        Object.assign(datiCapitale, datiCaricati);
        
        // Aggiorna l'interfaccia
        aggiornaInterfaccia();
        
        // Aggiorna i grafici
       // aggiornaGrafico();
        aggiornaGraficoStorico();
        aggiornaGraficoPercentuale();
        
        // Ricalcola le statistiche percentuali
        calcolaStatistichePercentuali();
        
        // Salva i dati in localStorage
        salvaDatiLocali();
     
        alert('Dati caricati con successo!');
      } catch (error) {
        alert('Errore durante il caricamento dei dati: ' + error.message);
      }
    };
    
    reader.readAsText(file);
  }
  
  // Funzione per aggiungere un indicatore del tempo del capitale
  function aggiungiIndicatoreTempo() {
    // Ottieni i dati più recenti
    const datiRecenti = filtraDatiPerPeriodo(datiCapitale.storicoCapitale, 30); // ultimi 30 giorni
    
    if (datiRecenti.length < 2) return; // Servono almeno 2 punti dati per calcolare una tendenza
    
    // Calcola il trend del capitale in trading
    const primoValore = datiRecenti[0].totaleIn;
    const ultimoValore = datiRecenti[datiRecenti.length - 1].totaleIn;
    const differenza = ultimoValore - primoValore;
    
    // Calcola la velocità media di variazione (trade al giorno)
    const giorniPassati = (new Date(datiRecenti[datiRecenti.length - 1].data) - new Date(datiRecenti[0].data)) / (1000 * 60 * 60 * 24);
    const velocitaMediaGiornaliera = giorniPassati > 0 ? differenza / giorniPassati : 0;
    
    // Calcola il tempo stimato per raggiungere il 100% o tornare allo 0% del capitale in trading
    let tempoStimato = 0;
    let messaggio = "";
    
    if (velocitaMediaGiornaliera > 0) {
      // Stiamo aumentando il capitale in trading, calcoliamo quanto tempo per arrivare al 100%
      const tradeRimanenti = datiCapitale.totaleTrade - ultimoValore;
      tempoStimato = velocitaMediaGiornaliera > 0 ? Math.ceil(tradeRimanenti / velocitaMediaGiornaliera) : Infinity;
      messaggio = `Al ritmo attuale, il 100% del capitale sarà in trading tra circa ${tempoStimato} giorni`;
    } else if (velocitaMediaGiornaliera < 0) {
      // Stiamo diminuendo il capitale in trading, calcoliamo quanto tempo per tornare allo 0%
      tempoStimato = velocitaMediaGiornaliera < 0 ? Math.ceil(ultimoValore / Math.abs(velocitaMediaGiornaliera)) : Infinity;
      messaggio = `Al ritmo attuale, il capitale in trading sarà esaurito tra circa ${tempoStimato} giorni`;
    } else {
      messaggio = "Il capitale in trading è stabile, nessuna variazione rilevata nell'ultimo periodo";
    }
    
    // Crea o aggiorna l'elemento HTML per l'indicatore del tempo
    let indicatoreElement = document.getElementById("indicatoreTempo");
    if (!indicatoreElement) {
      indicatoreElement = document.createElement("div");
      indicatoreElement.id = "indicatoreTempo";
      indicatoreElement.className = "info-box";
      
      // Inseriscilo prima del grafico percentuale
      const container = document.getElementById("tab-percentuale");
      const graficoContainer = container.querySelector(".storico-chart-container");
      container.insertBefore(indicatoreElement, graficoContainer);
    }
    
    // Aggiorna il contenuto dell'indicatore
    indicatoreElement.innerHTML = `
      <strong>Indicatore di Tendenza:</strong> ${messaggio}<br>
      <span class="distribution-label">Variazione media: ${velocitaMediaGiornaliera.toFixed(2)} trade al giorno</span>
    `;
    
    // Aggiungi un colore in base alla tendenza
    if (velocitaMediaGiornaliera > 0) {
      indicatoreElement.style.borderLeft = "4px solid var(--accent-color)";
    } else if (velocitaMediaGiornaliera < 0) {
      indicatoreElement.style.borderLeft = "4px solid var(--secondary-color)";
    } else {
      indicatoreElement.style.borderLeft = "4px solid var(--primary-color)";
    }
  }
  
  // Inizializza l'applicazione quando il documento è pronto
  document.addEventListener('DOMContentLoaded', function() {
    inizializza();
// 	window.addEventListener('resize', gestisciRidimensionamento);
    
    // Aggiungi l'indicatore del tempo dopo l'inizializzazione
    aggiungiIndicatoreTempo();
    
    // Aggiorna l'indicatore quando cambia il range di tempo
    document.querySelectorAll('.time-range-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        aggiungiIndicatoreTempo();
      });
    });
  });