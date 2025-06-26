// indicators.js - Gestione Indicatori Tecnici
// Versione: 1.1

(function() {
  // Oggetto per tenere traccia delle serie degli indicatori
  let indicatorSeries = {};

  // --- Calcolo EMA ---
  function calculateEMA(data, period) {
    if (!data || data.length < period) return [];
    const emaData = [];
    const k = 2 / (period + 1);
    let emaPrev = data[0].close;
    for (let i = 0; i < data.length; i++) {
      const ema = i === 0 ? data[i].close : (data[i].close - emaPrev) * k + emaPrev;
      emaPrev = ema;
      if (i >= period - 1) emaData.push({ time: data[i].time, value: ema });
    }
    return emaData;
  }

  // --- Calcolo Bollinger Bands ---
  function calculateBollingerBands(data, period, stdDevMultiplier) {
    if (!data || data.length < period) return { upper: [], middle: [], lower: [] };
    const bands = { upper: [], middle: [], lower: [] };
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = slice.reduce((sum, c) => sum + c.close, 0) / period;
      const variance = slice.reduce((sum, c) => sum + Math.pow(c.close - mean, 2), 0) / period;
      const stdev = Math.sqrt(variance);
      bands.middle.push({ time: data[i].time, value: mean });
      bands.upper.push({ time: data[i].time, value: mean + stdev * stdDevMultiplier });
      bands.lower.push({ time: data[i].time, value: mean - stdev * stdDevMultiplier });
    }
    return bands;
  }

  // --- Calcolo Linear Regression ---
  function calculateLinearRegression(data, period, deviationMultiplier) {
    if (!data || data.length < period) return { middle: [], upper: [], lower: [] };
    const linReg = [];
    const upper = [];
    const lower = [];
    for (let i = period - 1; i < data.length; i++) {
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let j = 0; j < period; j++) {
        const x = j + 1;
        const y = data[i - period + 1 + j].close;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
      }
      const slope = (period * sumXY - sumX * sumY) / (period * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / period;
      const regValue = slope * period + intercept;
      let variance = 0;
      for (let j = 0; j < period; j++) {
        const x = j + 1;
        const y = data[i - period + 1 + j].close;
        const yPred = slope * x + intercept;
        variance += Math.pow(y - yPred, 2);
      }
      const stdev = Math.sqrt(variance / period);
      linReg.push({ time: data[i].time, value: regValue });
      upper.push({ time: data[i].time, value: regValue + deviationMultiplier * stdev });
      lower.push({ time: data[i].time, value: regValue - deviationMultiplier * stdev });
    }
    return { middle: linReg, upper: upper, lower: lower };
  }

  // --- Funzione per aggiornare gli indicatori ---
  function updateIndicators(chart, candleSeries, candleData) {
    // Rimuovi tutte le serie indicatori precedenti
    Object.keys(indicatorSeries).forEach(key => {
      if (indicatorSeries[key]) {
        chart.removeSeries(indicatorSeries[key]);
      }
    });
    indicatorSeries = {};

    // Calcola indicatori SOLO se ci sono abbastanza dati
    if (!candleData || candleData.length < 100) {
      console.warn('Non ci sono abbastanza dati per calcolare gli indicatori');
      return;
    }

    // --- Medie mobili ---
    const ema21Data = calculateEMA(candleData, 21);
    const ema50Data = calculateEMA(candleData, 50);
    indicatorSeries.ema21 = chart.addSeries(LightweightCharts.LineSeries, { color: '#FF9800', lineWidth: 2 });
    indicatorSeries.ema21.setData(ema21Data);
    indicatorSeries.ema50 = chart.addSeries(LightweightCharts.LineSeries, { color: '#F44336', lineWidth: 2 });
    indicatorSeries.ema50.setData(ema50Data);

    // --- Bollinger Bands ---
    const bbData = calculateBollingerBands(candleData, 20, 2);
    indicatorSeries.bb_upper = chart.addSeries(LightweightCharts.LineSeries, { color: '#81C784', lineWidth: 1 });
    indicatorSeries.bb_middle = chart.addSeries(LightweightCharts.LineSeries, { color: '#4CAF50', lineWidth: 1 });
    indicatorSeries.bb_lower = chart.addSeries(LightweightCharts.LineSeries, { color: '#E57373', lineWidth: 1 });
    indicatorSeries.bb_upper.setData(bbData.upper);
    indicatorSeries.bb_middle.setData(bbData.middle);
    indicatorSeries.bb_lower.setData(bbData.lower);

    // --- Linear Regression ---
    const linRegData = calculateLinearRegression(candleData, 100, 1);
    // Rimuovi eventuali serie precedenti (se presenti)
    ['lr_upper', 'lr_middle', 'lr_lower', 'lr_channel'].forEach(key => {
      if (indicatorSeries[key]) chart.removeSeries(indicatorSeries[key]);
    });
    // Crea le linee
    indicatorSeries.lr_upper = chart.addSeries(LightweightCharts.LineSeries, { color: '#00BCD4', lineWidth: 1, lineStyle: 0 });
    indicatorSeries.lr_middle = chart.addSeries(LightweightCharts.LineSeries, { color: '#2196F3', lineWidth: 2, lineStyle: 0 });
    indicatorSeries.lr_lower = chart.addSeries(LightweightCharts.LineSeries, { color: '#00BCD4', lineWidth: 1, lineStyle: 0 });
    indicatorSeries.lr_upper.setData(linRegData.upper);
    indicatorSeries.lr_middle.setData(linRegData.middle);
    indicatorSeries.lr_lower.setData(linRegData.lower);

    // (Opzionale, solo effetto visivo, NON canale reale)
    indicatorSeries.lr_channel = chart.addSeries(LightweightCharts.AreaSeries, {
      topColor: 'rgba(0,188,212,0.10)',
      bottomColor: 'rgba(0,188,212,0.02)',
      lineColor: 'rgba(0,0,0,0)',
      lineWidth: 1,
    });
    const areaData = linRegData.upper.map((u, i) => ({
      time: u.time,
      value: u.value,
    }));
    indicatorSeries.lr_channel.setData(areaData);
  }

  // Espone la funzione pubblica
  window.TechnicalIndicators = { updateIndicators };
})();
