// logica.js - Strategia Multi-Confluenza con salvataggio locale

// ================= CONFIGURAZIONI =================

const config = {
    lengthInput: 100,
    linregSensitivity: 0.8,
    minPearsonForLinreg: 0.2,
    minPearson: 0.5,

    useUpperDevInput: true,
    upperMultInput: 1.0,
    useLowerDevInput: true,
    lowerMultInput: 1.0,

    useBbFilter: true,
    usePivotFilter: true,
    useStochRsiFilter: true,
    useMaCrossFilter: true,
    useMomentumFilter: true,
    usePriceActionFilter: true,
    useMacdFilter: true,

    stochRsiLength: 14,
    stochRsiRsiLength: 14,
    stochRsiK: 1,
    stochRsiD: 2,
    stochOversold: 20,
    stochOverbought: 80,

    emaLength: 21,
    smaLength: 50,
    rsiMomentumLength: 14,

    momentumLength: 10,
    macdFastLength: 12,
    macdSlowLength: 26,
    macdSignalLength: 9,

    bbLength: 20,
    bbMult: 2.0,
};

// ================= VARIABILI DI STATO =================

const state = {
    prices: [],
    highs: [],
    lows: [],
    opens: [],
    lastUpdate: null, // per gestire anche un timer
};

// ================= SALVATAGGIO E RIPRISTINO =================

function saveState(symbol) {
    const savedData = {
        prices: state.prices,
        highs: state.highs,
        lows: state.lows,
        opens: state.opens,
        lastUpdate: Date.now(),
    };
    localStorage.setItem(`savedState_${symbol}`, JSON.stringify(savedData));
}

function loadState(symbol) {
    const saved = localStorage.getItem(`savedState_${symbol}`);
    if (!saved) return false;

    try {
        const data = JSON.parse(saved);
        state.prices = data.prices || [];
        state.highs = data.highs || [];
        state.lows = data.lows || [];
        state.opens = data.opens || [];
        state.lastUpdate = data.lastUpdate || null;

        console.log(`Stato recuperato da LocalStorage per ${symbol}`);
        return true;
    } catch (error) {
        console.error('Errore nel caricamento dello stato salvato:', error);
        return false;
    }
}

// ================= FUNZIONI DI UTILITÀ =================

function sma(values, period) {
    if (values.length < period) return 0;
    let sum = 0;
    for (let i = values.length - period; i < values.length; i++) {
        sum += values[i];
    }
    return sum / period;
}

function ema(values, period) {
    if (values.length < period) return 0;
    const multiplier = 2 / (period + 1);
    let emaValue = values[values.length - period];
    for (let i = values.length - period + 1; i < values.length; i++) {
        emaValue = (values[i] - emaValue) * multiplier + emaValue;
    }
    return emaValue;
}

function stdev(values, period) {
    if (values.length < period) return 0;
    const subset = values.slice(-period);
    const mean = subset.reduce((a, b) => a + b, 0) / period;
    const variance = subset.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    return Math.sqrt(variance);
}

function rsi(values, period) {
    if (values.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = values.length - period; i < values.length; i++) {
        let change = values[i] - values[i - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function highest(values, period) {
    if (values.length < period) return 0;
    return Math.max(...values.slice(-period));
}

function lowest(values, period) {
    if (values.length < period) return 0;
    return Math.min(...values.slice(-period));
}

// ================= CALCOLI =================

function calculateIndicators() {
    if (state.prices.length < Math.max(config.lengthInput, config.bbLength, config.emaLength, config.smaLength, config.momentumLength + 1)) {
        console.log('Dati insufficienti per il calcolo degli indicatori.');
        return null;
    }

    const currentPrice = state.prices[state.prices.length - 1];

    const bbBasis = sma(state.prices, config.bbLength);
    const bbDev = config.bbMult * stdev(state.prices, config.bbLength);
    const bbUpper = bbBasis + bbDev;
    const bbLower = bbBasis - bbDev;
    const bbPosition = ((currentPrice - bbLower) / (bbUpper - bbLower)) * 2 - 1;

    const emaValue = ema(state.prices, config.emaLength);
    const smaValue = sma(state.prices, config.smaLength);
    const trendBullish = emaValue > smaValue && currentPrice > emaValue;
    const trendBearish = emaValue < smaValue && currentPrice < emaValue;

    let momentumBullish = false;
    let momentumBearish = false;

    if (state.prices.length >= config.momentumLength + 1) {
        const momentum = currentPrice - state.prices[state.prices.length - config.momentumLength - 1];
        momentumBullish = momentum > 0;
        momentumBearish = momentum < 0;
    }

    const stochData = calcStochRsi();
    const stochK = stochData ? stochData[0] : 0;
    const stochD = stochData ? stochData[1] : 0;

    console.log('Calcoli indicatori:', {
        bbPosition,
        emaValue,
        smaValue,
        trendBullish,
        trendBearish,
        momentumBullish,
        momentumBearish,
        stochK,
        stochD
    });

    return {
        bbPosition,
        trendBullish,
        trendBearish,
        momentumBullish,
        momentumBearish,
        stochK,
        stochD
    };
}

function calcStochRsi() {
    if (state.prices.length < Math.max(config.stochRsiRsiLength, config.stochRsiLength + config.stochRsiD - 1)) {
        return [50, 50];
    }

    const rsiValues = [];
    for (let i = config.stochRsiRsiLength; i < state.prices.length; i++) {
        const subset = state.prices.slice(i - config.stochRsiRsiLength, i + 1);
        rsiValues.push(rsi(subset, config.stochRsiRsiLength));
    }

    if (rsiValues.length < config.stochRsiLength + config.stochRsiD - 1) {
        return [50, 50];
    }

    const highestRsi = highest(rsiValues.slice(-config.stochRsiLength), config.stochRsiLength);
    const lowestRsi = lowest(rsiValues.slice(-config.stochRsiLength), config.stochRsiLength);
    const currentRsi = rsiValues[rsiValues.length - 1];

    const stochRsiK = (highestRsi !== lowestRsi) ?
        100 * (currentRsi - lowestRsi) / (highestRsi - lowestRsi) : 50;

    const recentKs = [];
    for (let i = rsiValues.length - config.stochRsiD; i < rsiValues.length; i++) {
        const h = highest(rsiValues.slice(i - config.stochRsiLength + 1, i + 1), config.stochRsiLength);
        const l = lowest(rsiValues.slice(i - config.stochRsiLength + 1, i + 1), config.stochRsiLength);
        const val = (h !== l) ? 100 * (rsiValues[i] - l) / (h - l) : 50;
        recentKs.push(val);
    }
    const stochRsiD = sma(recentKs, recentKs.length);

    return [stochRsiK, stochRsiD];
}

// ================= AGGIUNTA DATI =================

function addTick(open, high, low, close, symbol = 'btcusdt') {
    state.opens.push(open);
    state.highs.push(high);
    state.lows.push(low);
    state.prices.push(close);
    state.lastUpdate = Date.now();

    const maxSize = config.lengthInput + 50;
    if (state.prices.length > maxSize) {
        state.opens.shift();
        state.highs.shift();
        state.lows.shift();
        state.prices.shift();
    }

    saveState(symbol);
}

function processNewCandle(candle, symbol = 'btcusdt') {
    addTick(candle.open, candle.high, candle.low, candle.close, symbol);
    const result = calculateIndicators();

    if (result) {
        console.log("processNewCandle:", candle, result);

        const linregFake = (Math.random() * 2 - 1).toFixed(2);
        const pearsonFake = (Math.random() * 2 - 1).toFixed(2);

        return {
            linreg: parseFloat(linregFake),
            pearson: parseFloat(pearsonFake),
            bb: result.bbPosition,
            stoch: result.stochK,
            score: (result.bbPosition + result.stochK + parseFloat(linregFake) + parseFloat(pearsonFake)) / 4
        };
    } else {
        console.log("Indicatore non calcolabile, probabilmente dati insufficienti.");
    }

    return null;
}

// ================= ESPORTAZIONE =================

export { addTick, calculateIndicators, state, config, processNewCandle, saveState, loadState };
