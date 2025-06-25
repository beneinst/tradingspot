// logica.js - Strategia Multi-Confluenza aggiornata con indicatori secondari e timer

// ================= CONFIGURAZIONI =================
const config = {
    lengthInput: 100,
    bbLength: 20,
    bbMult: 2.0,
    emaLength: 21,
    smaLength: 50,
    rsiMomentumLength: 14,
    momentumLength: 10,
    macdFastLength: 12,
    macdSlowLength: 26,
    macdSignalLength: 9,
    stochRsiLength: 14,
    stochRsiRsiLength: 14,
    stochRsiD: 2,
    dataTimeout: 5 * 60 * 1000,
    maxDataAge: 24 * 60 * 60 * 1000
};

// ================= VARIABILI DI STATO =================
const state = {
    prices: [],
    highs: [],
    lows: [],
    opens: [],
    timestamps: [],
    lastUpdate: null,
    version: '1.1'
};

// ================= UTILS =================
function sma(values, period) {
    if (values.length < period) return 0;
    let sum = 0;
    for (let i = values.length - period; i < values.length; i++) sum += values[i];
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

// ================= INDICATORI PRINCIPALI =================
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

    const stochK = 50; // semplificato per esempio
    const stochD = 50;
    const rsiValue = rsi(state.prices, config.rsiMomentumLength);

    return {
        bbPosition: Number(bbPosition.toFixed(4)),
        bbUpper: Number(bbUpper.toFixed(2)),
        bbLower: Number(bbLower.toFixed(2)),
        bbBasis: Number(bbBasis.toFixed(2)),
        stochK: Number(stochK.toFixed(2)),
        stochD: Number(stochD.toFixed(2)),
        rsi: Number(rsiValue.toFixed(2)),
        ema: Number(emaValue.toFixed(2)),
        sma: Number(smaValue.toFixed(2)),
        currentPrice: Number(currentPrice.toFixed(2))
    };
}

// ================= INDICATORI SECONDARI =================
function calculateMACD() {
    if (state.prices.length < config.macdSlowLength) return { status: "NEUTRO" };
    const fast = ema(state.prices, config.macdFastLength);
    const slow = ema(state.prices, config.macdSlowLength);
    const macdLine = fast - slow;
    const signalLine = ema([...state.prices.slice(-config.macdSlowLength), macdLine], config.macdSignalLength);
    return {
        status: macdLine > signalLine ? "BULLISH" : macdLine < signalLine ? "BEARISH" : "NEUTRO"
    };
}

function calculateMomentum() {
    if (state.prices.length < config.momentumLength + 1) return { status: "NEUTRO" };
    const momentum = state.prices[state.prices.length - 1] - state.prices[state.prices.length - 1 - config.momentumLength];
    return {
        status: momentum > 0 ? "BULLISH" : momentum < 0 ? "BEARISH" : "NEUTRO"
    };
}

function calculateTrend() {
    if (state.prices.length < config.smaLength) return { status: "NEUTRO" };
    const emaValue = ema(state.prices, config.emaLength);
    const smaValue = sma(state.prices, config.smaLength);
    return {
        status: emaValue > smaValue ? "BULLISH" : emaValue < smaValue ? "BEARISH" : "NEUTRO"
    };
}

function calculatePriceAction() {
    // Semplificato: se ultima candela verde -> BULLISH, rossa -> BEARISH, altro -> NEUTRO
    if (state.opens.length < 1 || state.prices.length < 1) return { status: "NEUTRO" };
    const open = state.opens[state.opens.length - 1];
    const close = state.prices[state.prices.length - 1];
    return {
        status: close > open ? "BULLISH" : close < open ? "BEARISH" : "NEUTRO"
    };
}

// ================= CONDIZIONI BASE =================
function getConditionChecks(indicators, macd, momentum, trend, pa) {
    return {
        linregCheck: Math.abs(indicators.linreg) > 0.1 ? "✔️" : "❌",
        pearsonCheck: Math.abs(indicators.pearson) > 0.2 ? "✔️" : "❌",
        secondaryCheck: 
            [macd.status, momentum.status, trend.status, pa.status]
                .filter(s => s === "BULLISH" || s === "BEARISH").length + "/4"
    };
}

// ================= TIMER E PATTERN (ESEMPI) =================
let lastSignalTime = null;
let lastSignalType = "--";
let barsElapsed = "--";
let barsRemaining = "--";

function updateTimerAndSignals(result) {
    // Esempio: aggiorna timer e segnali in base al segnale principale
    if (result.mainSignal && result.mainSignal !== "IN ATTESA") {
        lastSignalTime = new Date(result.timestamp).toLocaleString();
        lastSignalType = result.mainSignal;
        barsElapsed = 0;
        barsRemaining = 12; // esempio
    } else {
        barsElapsed = "--";
        barsRemaining = "--";
    }
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
    return true;
}

// ================= PROCESSAMENTO =================
let lastIndicators = null;

function processNewCandle(candle, symbol = 'btcusdt') {
    if (!candle || typeof candle !== 'object') return null;
    const { open, high, low, close, timestamp } = candle;
    if (!addTick(open, high, low, close, timestamp, symbol)) return null;
    const indicators = calculateIndicators();
    if (!indicators) return null;

    // Calcoli reali
    const linreg = calculateLinReg();
    const pearson = calculatePearson();
    indicators.linreg = linreg;
    indicators.pearson = pearson;

    // Indicatori secondari
    const macd = calculateMACD();
    const momentum = calculateMomentum();
    const trend = calculateTrend();
    const pa = calculatePriceAction();

    // Condizioni base
    const cond = getConditionChecks(indicators, macd, momentum, trend, pa);

    // Pattern (esempio fittizio)
    const patterns = [];

    // Segnale principale (esempio)
    let mainSignal = "IN ATTESA";
    let signalStrength = 0.0;
    if (indicators.score > 0.5) {
        mainSignal = "BUY";
        signalStrength = indicators.score;
    } else if (indicators.score < -0.5) {
        mainSignal = "SELL";
        signalStrength = indicators.score;
    }

    // Statistiche timer
    updateTimerAndSignals({ mainSignal, timestamp });

    const result = {
        ...indicators,
        score: Number(((indicators.bbPosition + indicators.stochK/100 + linreg + pearson) / 4).toFixed(4)),
        candles: state.prices.length,
        isStale: false,
        // Indicatori secondari
        macdStatus: macd.status,
        momentumStatus: momentum.status,
        trendStatus: trend.status,
        paStatus: pa.status,
        // Condizioni base
        linregCheck: cond.linregCheck,
        pearsonCheck: cond.pearsonCheck,
        secondaryCheck: cond.secondaryCheck,
        // Statistiche timer
        lastSignalTime,
        lastSignalType,
        barsElapsed,
        barsRemaining,
        // Pattern candele
        patterns,
        // Segnale principale
        mainSignal,
        signalStrength
    };
    lastIndicators = result;
    return result;
}

// ================= CALCOLI LINREG E PEARSON =================
function calculateLinReg() {
    const prices = state.prices.slice(-config.lengthInput);
    if (prices.length < 2) return 0;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < prices.length; i++) {
        sumX += i;
        sumY += prices[i];
        sumXY += i * prices[i];
        sumX2 += i * i;
    }
    const n = prices.length;
    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return 0;
    const slope = (n * sumXY - sumX * sumY) / denominator;
    return slope;
}

function calculatePearson() {
    const prices = state.prices.slice(-config.lengthInput);
    if (prices.length < 2) return 0;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < prices.length; i++) {
        sumX += i;
        sumY += prices[i];
        sumXY += i * prices[i];
        sumX2 += i * i;
        sumY2 += prices[i] * prices[i];
    }
    const n = prices.length;
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
        (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
    );
    if (denominator === 0) return 0;
    return numerator / denominator;
}

// ================= INFO E VALIDAZIONE =================
function getLastIndicators() {
    return lastIndicators;
}

function getStateInfo(symbol = 'btcusdt') {
    return {
        symbol,
        candles: state.prices.length,
        lastUpdate: state.lastUpdate,
        isStale: false,
        dataAge: state.lastUpdate ? Date.now() - state.lastUpdate : null,
        memoryUsage: JSON.stringify(state).length,
        version: state.version
    };
}

// ================= SALVATAGGIO E RIPRISTINO STATO =================
function saveState(symbol) {
    const savedData = {
        prices: state.prices,
        highs: state.highs,
        lows: state.lows,
        opens: state.opens,
        timestamps: state.timestamps,
        lastUpdate: state.lastUpdate,
        lastSignalTime,     // Salva anche il timer!
        lastSignalType,
        barsElapsed,
        barsRemaining,
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
        state.prices = data.prices || [];
        state.highs = data.highs || [];
        state.lows = data.lows || [];
        state.opens = data.opens || [];
        state.timestamps = data.timestamps || [];
        state.lastUpdate = data.lastUpdate || null;
        // Timer e segnali
        lastSignalTime = data.lastSignalTime || null;
        lastSignalType = data.lastSignalType || "--";
        barsElapsed = data.barsElapsed || "--";
        barsRemaining = data.barsRemaining || "--";
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
    lastSignalTime = null;
    lastSignalType = "--";
    barsElapsed = "--";
    barsRemaining = "--";
}


// ================= EXPORT =================
export {
    processNewCandle,
    getLastIndicators,
    getStateInfo,
    addTick,
    calculateIndicators,
    state,
    config,
    saveState,
    loadState,
    clearState
};
