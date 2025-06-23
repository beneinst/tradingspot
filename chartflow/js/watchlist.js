window.addEventListener('DOMContentLoaded', function() {
  const watchlistSymbols = ['BTCUSDC', 'ETHUSDC', 'BNBUSDC', 'SOLUSDC', 'ADAUSDC', 'FETUSDC'];
  const watchlistEl = document.getElementById('watchlist');
  if (!watchlistEl) {
    console.error('Elemento #watchlist non trovato nel DOM');
    return;
  }
  let selectedSymbol = watchlistSymbols[0];

  // Funzione per caricare i dati da Binance
  function loadBinanceData(symbol) {
    fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=4h&limit=100`)
      .then(response => response.json())
      .then(data => {
        const formatted = data.map(c => ({
          time: Math.floor(c[0] / 1000),
          open: parseFloat(c[1]),
          high: parseFloat(c[2]),
          low: parseFloat(c[3]),
          close: parseFloat(c[4]),
        }));
        candleSeries.setData(formatted);
      })
      .catch(err => console.error('Errore caricamento dati Binance:', err));
  }
<ul id="watchlist"></ul>
  // Inizializza la watchlist
  watchlistSymbols.forEach(symbol => {
    const li = document.createElement('li');
    li.textContent = symbol;
    li.onclick = () => {
      document.querySelectorAll('#watchlist li').forEach(el => el.classList.remove('selected'));
      li.classList.add('selected');
      selectedSymbol = symbol;
      loadBinanceData(symbol);
    };
    if (symbol === selectedSymbol) li.classList.add('selected');
    watchlistEl.appendChild(li);
  });

  // Inizializza il grafico
  const chartContainer = document.getElementById('chart');
  const chart = LightweightCharts.createChart(chartContainer, {
    width: chartContainer.clientWidth,
    height: chartContainer.clientHeight,
    layout: { background: { color: '#181a20' }, textColor: '#d1d4dc' },
    grid: { vertLines: { color: '#222' }, horzLines: { color: '#222' } },
    timeScale: { timeVisible: true, secondsVisible: false },
  });
  let candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
    upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
    wickUpColor: '#26a69a', wickDownColor: '#ef5350',
  });

  // Carica il primo simbolo all'avvio
  loadBinanceData(selectedSymbol);

  // Resize dinamico
  window.addEventListener('resize', () => {
    chart.resize(chartContainer.clientWidth, chartContainer.clientHeight);
  });
});
