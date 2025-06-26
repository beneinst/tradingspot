window.addEventListener('DOMContentLoaded', function() {
  const chartContainer = document.getElementById('chart');
  const chart = LightweightCharts.createChart(chartContainer, {
    width: chartContainer.clientWidth,
    height: chartContainer.clientHeight,
    layout: {
      background: { color: '#181a20' },
      textColor: '#d1d4dc',
    },
    grid: {
      vertLines: { color: '#222' },
      horzLines: { color: '#222' },
    },
    timeScale: { timeVisible: true, secondsVisible: false },
  });

  // Cambiato qui!
  const candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderVisible: false,
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
  });

  candleSeries.setData([
    { time: '2025-06-17', open: 100, high: 110, low: 90, close: 105 },
    { time: '2025-06-18', open: 105, high: 112, low: 100, close: 108 },
    { time: '2025-06-19', open: 108, high: 115, low: 107, close: 112 },
    { time: '2025-06-20', open: 112, high: 120, low: 110, close: 118 },
    { time: '2025-06-21', open: 118, high: 125, low: 115, close: 122 },
  ]);

  window.addEventListener('resize', () => {
    chart.resize(chartContainer.clientWidth, chartContainer.clientHeight);
  });
});
