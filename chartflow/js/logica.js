// logica.js - Strategia Multi-Confluenza pulita e aggiornata

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
    dataTimeout: 5 * 60 * 1000, // 5 minuti
    maxDataAge: 24 * 60 * 60 * 1000 // 24 ore
};

// ================= VARIABILI DI STATO =================
const state = {
    prices: [],
    highs: [],
    lows: [],
    opens: [],
    timestamps: [],
    lastUpdate: null,
    version: '1.0'
};

// ================= SALVATAGGIO E RIPRISTINO =================
function saveState(symbol) {
    const savedData = {
        prices: state.prices,
        highs: state.highs,
        lows: state.lows,
        opens: state.opens,
        timestamps: state.timestamps,
        lastUpdate: Date.now(),
        version: state.version,
    };
    try {
        localStorage.setItem(`savedState_${symbol}`, JSON.stringify(savedData));
        return true;
    } catch (error) {
        console.error('Errore nel salvataggio dello stato:', error);
        return false;
    }
}

function loadState(symbol) {
    const saved = localStorage.getItem(`savedState_${symbol}`);
    if (!saved) return false;
    try {
        const data = JSON.parse(saved);
        if (data.version !== state.version) {
            clearState(symbol);
            return false;
        }
        const dataAge = Date.now() - (data.lastUpdate || 0);
        if (dataAge > config.maxDataAge) {
            clearState(symbol);
            return false;
        }
        state.prices = data.prices || [];
        state.highs = data.highs || [];
        state.lows = data.lows || [];
        state.opens = data.opens || [];
        state.timestamps = data.timestamps || [];
        state.lastUpdate = data.lastUpdate || null;
        return true;
    } catch (error) {
        clearState(symbol);
        return false;
    }
}

function clearState(symbol) {
    localStorage.removeItem(`savedState_${symbol}`);
    state.prices = [];
    state.highs = [];
    state.lows = [];
    state.opens = [];
    state.timestamps = [];
    state.lastUpdate = null;
}

function isDataStale() {
    if (!state.lastUpdate) return true;
    return (Date.now() - state.lastUpdate) > config.dataTimeout;
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
    let emaValue = sma(values.slice(0, period), period);
    for (let i = period; i < values.length; i++) {
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
    for (let i = 1; i <= period; i++) {
        const change = values[i] - values[i - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    for (let i = period + 1; i < values.length; i++) {
        const change = values[i] - values[i - 1];
        if (change > 0) {
            avgGain = (avgGain * (period - 1) + change) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        } else {
            avgGain = (avgGain * (period - 1)) / period;
            avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
        }
    }
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

// ================= CALCOLI INDICATORI =================
function calculateIndicators() {
    const minRequiredCandles = Math.max(
        config.lengthInput, 
        config.bbLength, 
        config.emaLength, 
        config.smaLength, 
        config.momentumLength + 1,
        config.stochRsiRsiLength + config.stochRsiLength
    );
    if (state.prices.length < minRequiredCandles) return null;

    const currentPrice = state.prices[state.prices.length - 1];
    const bbBasis = sma(state.prices, config.bbLength);
    const bbDev = config.bbMult * stdev(state.prices, config.bbLength);
    const bbUpper = bbBasis + bbDev;
    const bbLower = bbBasis - bbDev;
    const bbPosition = bbUpper !== bbLower ? 
        ((currentPrice - bbLower) / (bbUpper - bbLower)) * 2 - 1 : 0;

    const emaValue = ema(state.prices, config.emaLength);
    const smaValue = sma(state.prices, config.smaLength);

    let momentumBullish = false;
    let momentumBearish = false;
    if (state.prices.length >= config.momentumLength + 1) {
        const momentum = currentPrice - state.prices[state.prices.length - config.momentumLength - 1];
        momentumBullish = momentum > 0;
        momentumBearish = momentum < 0;
    }

    const stochData = calcStochRsiSimplified();
    const stochK = stochData.k;
    const stochD = stochData.d;

    const rsiValue = rsi(state.prices, config.rsiMomentumLength);

    return {
        bbPosition: Number(bbPosition.toFixed(4)),
        bbUpper: Number(bbUpper.toFixed(2)),
        bbLower: Number(bbLower.toFixed(2)),
        bbBasis: Number(bbBasis.toFixed(2)),
        momentumBullish,
        momentumBearish,
        stochK: Number(stochK.toFixed(2)),
        stochD: Number(stochD.toFixed(2)),
        rsi: Number(rsiValue.toFixed(2)),
        ema: Number(emaValue.toFixed(2)),
        sma: Number(smaValue.toFixed(2)),
        currentPrice: Number(currentPrice.toFixed(2))
    };
}

// StochRSI semplificato
function calcStochRsiSimplified() {
    const requiredLength = config.stochRsiRsiLength + config.stochRsiLength;
    if (state.prices.length < requiredLength) return { k: 50, d: 50 };
    const rsiValues = [];
    for (let i = config.stochRsiRsiLength; i < state.prices.length; i++) {
        const subset = state.prices.slice(i - config.stochRsiRsiLength, i + 1);
        rsiValues.push(rsi(subset, config.stochRsiRsiLength));
    }
    if (rsiValues.length < config.stochRsiLength) return { k: 50, d: 50 };
    const recentRsi = rsiValues.slice(-config.stochRsiLength);
    const highestRsi = Math.max(...recentRsi);
    const lowestRsi = Math.min(...recentRsi);
    const currentRsi = rsiValues[rsiValues.length - 1];
    const stochK = (highestRsi !== lowestRsi) ?
        100 * (currentRsi - lowestRsi) / (highestRsi - lowestRsi) : 50;
    const kPeriod = Math.min(config.stochRsiD, rsiValues.length);
    const recentKs = [];
    for (let i = 0; i < kPeriod; i++) {
        const idx = rsiValues.length - kPeriod + i;
        if (idx >= config.stochRsiLength - 1) {
            const rsiSubset = rsiValues.slice(idx - config.stochRsiLength + 1, idx + 1);
            const maxRsi = Math.max(...rsiSubset);
            const minRsi = Math.min(...rsiSubset);
            const k = (maxRsi !== minRsi) ? 
                100 * (rsiValues[idx] - minRsi) / (maxRsi - minRsi) : 50;
            recentKs.push(k);
        }
    }
    const stochD = recentKs.length > 0 ? 
        recentKs.reduce((a, b) => a + b, 0) / recentKs.length : 50;
    return { k: stochK, d: stochD };
}

// ================= AGGIUNTA DATI =================
function addTick(open, high, low, close, timestamp = null, symbol = 'btcusdt') {
    if (typeof open !== 'number' || typeof high !== 'number' || 
        typeof low !== 'number' || typeof close !== 'number') return false;
    if (high < low || close < low || close > high || open < low || open > high) return false;
    state.opens.push(open);
    state.highs.push(high);
    state.lows.push(low);
    state.prices.push(close);
    state.timestamps.push(timestamp || Date.now());
    state.lastUpdate = Date.now();
    const maxSize = config.lengthInput + 50;
    if (state.prices.length > maxSize) {
        state.opens.shift();
        state.highs.shift();
        state.lows.shift();
        state.prices.shift();
        state.timestamps.shift();
    }
    return saveState(symbol);
}

// ================= PROCESSAMENTO =================
let lastIndicators = null;

function processNewCandle(candle, symbol = 'btcusdt') {
    if (!candle || typeof candle !== 'object') return null;
    const { open, high, low, close, timestamp } = candle;
    if (!addTick(open, high, low, close, timestamp, symbol)) return null;
    const indicators = calculateIndicators();
    if (indicators) {
        // Simulazione linreg e pearson (da sostituire con calcoli reali)
        const linregFake = (Math.random() * 2 - 1);
        const pearsonFake = (Math.random() * 2 - 1);
        const result = {
            timestamp: timestamp || Date.now(),
            linreg: Number(linregFake.toFixed(4)),
            pearson: Number(pearsonFake.toFixed(4)),
            bb: indicators.bbPosition,
            stochK: indicators.stochK,
            stochD: indicators.stochD,
            rsi: indicators.rsi,
            ema: indicators.ema,
            sma: indicators.sma,
            score: Number(((indicators.bbPosition + indicators.stochK/100 + linregFake + pearsonFake) / 4).toFixed(4)),
            candles: state.prices.length,
            isStale: isDataStale()
        };
        lastIndicators = result;
        return result;
    } else {
        return {
            timestamp: timestamp || Date.now(),
            candles: state.prices.length,
            error: 'insufficient_data',
            isStale: isDataStale()
        };
    }
}

function getLastIndicators() {
    return lastIndicators;
}

console.log('DEBUG getLastIndicators', getLastIndicators());

// ================= INFO E VALIDAZIONE =================
function getStateInfo(symbol = 'btcusdt') {
    return {
        symbol,
        candles: state.prices.length,
        lastUpdate: state.lastUpdate,
        isStale: isDataStale(),
        dataAge: state.lastUpdate ? Date.now() - state.lastUpdate : null,
        memoryUsage: JSON.stringify(state).length,
        version: state.version
    };
}

function validateConfig() {
    const requiredProps = ['lengthInput', 'bbLength', 'emaLength', 'smaLength'];
    for (const prop of requiredProps) {
        if (!config[prop] || config[prop] <= 0) return false;
    }
    return true;
}

// ================= EXPORT =================
export { 
    processNewCandle,
    getLastIndicators,
    getStateInfo,
    addTick,
    calculateIndicators,
    saveState,
    loadState,
    clearState as resetState,
    isDataStale,
    validateConfig,
    state,
    config
};
