// =================== CONFIGURAZIONE ===================
const config = {
    linregLength: 100,
    bbLength: 20,
    emaLength: 21,
    smaLength: 50,
    rsiLength: 14,
    timerPeriods: 12
};

const state = {
    prices: [],
    highs: [],
    lows: [],
    opens: [],
    volumes: [],
    timestamps: [],
    lastUpdate: null
};

let currentSignal = "NONE";  // "BUY", "SELL", "NONE"
let signalStartIndex = -1;
let timerCount = 0;

// =================== FUNZIONI INDICATORI ===================

function sma(period) {
    if (state.prices.length < period) return null;
    return state.prices.slice(-period).reduce((sum, val) => sum + val, 0) / period;
}

function ema(period) {
    if (state.prices.length < period) return null;
    let emaValue = sma(period);
    const alpha = 2 / (period + 1);
    for (let i = period; i < state.prices.length; i++) {
        emaValue = (state.prices[i] - emaValue) * alpha + emaValue;
    }
    return emaValue;
}

function rsi(period) {
    if (state.prices.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const change = state.prices[i] - state.prices[i - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    for (let i = period + 1; i < state.prices.length; i++) {
        const change = state.prices[i] - state.prices[i - 1];
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

function calculateLinReg() {
    if (state.prices.length < config.linregLength) return 0;
    const prices = state.prices.slice(-config.linregLength);
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < prices.length; i++) {
        sumX += i;
        sumY += prices[i];
        sumXY += i * prices[i];
        sumX2 += i * i;
    }
    const n = prices.length;
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
}

function calculateBollingerBands() {
    if (state.prices.length < config.bbLength) return { position: 0 };
    const prices = state.prices.slice(-config.bbLength);
    const basis = prices.reduce((sum, val) => sum + val, 0) / config.bbLength;
    const stdDev = Math.sqrt(prices.map(p => Math.pow(p - basis, 2)).reduce((sum, val) => sum + val, 0) / config.bbLength);
    const upper = basis + 2 * stdDev;
    const lower = basis - 2 * stdDev;
    const currentPrice = state.prices[state.prices.length - 1];
    const position = (currentPrice - lower) / (upper - lower);
    return { position, upper, lower, basis };
}

function calculateMACD() {
    if (state.prices.length < config.macdSlow) return { histogram: 0 };
    const emaFast = ema(config.macdFast);
    const emaSlow = ema(config.macdSlow);
    if (emaFast === null || emaSlow === null) return { histogram: 0 };
    const macdLine = emaFast - emaSlow;
    return { histogram: macdLine };
}

// =================== GESTIONE SEGNALI E TIMER ===================

function checkSignal() {
    const ema = ema(config.emaLength);
    const sma = sma(config.smaLength);
    const rsiValue = rsi(config.rsiLength);
    if (ema === null || sma === null) return "NONE";
    if (ema > sma && rsiValue > 50) return "BUY";
    if (ema < sma && rsiValue < 50) return "SELL";
    return "NONE";
}

function updateTimer(newSignal) {
    if (newSignal === "NONE") {
        timerCount = 0;
        currentSignal = "NONE";
    } else if (currentSignal === "NONE") {
        currentSignal = newSignal;
        timerCount = 1;
    } else if (newSignal !== currentSignal) {
        currentSignal = newSignal;
        timerCount = 1;
    } else {
        if (timerCount < config.timerPeriods) timerCount++;
        else {
            currentSignal = "NONE";
            timerCount = 0;
        }
    }
}

// =================== PROCESSAMENTO CANDELA ===================

export function processNewCandle(candle, symbol = 'btcusdt') {
    // Aggiungi candela allo stato
    state.opens.push(candle.open);
    state.highs.push(candle.high);
    state.lows.push(candle.low);
    state.prices.push(candle.close);
    state.volumes.push(candle.volume);
    state.timestamps.push(candle.timestamp);
    state.lastUpdate = Date.now();

    // Mantieni dimensioni massime
    const maxSize = Math.max(config.linregLength, config.bbLength, config.smaLength) + 50;
    if (state.prices.length > maxSize) {
        state.opens.shift();
        state.highs.shift();
        state.lows.shift();
        state.prices.shift();
        state.volumes.shift();
        state.timestamps.shift();
    }

    // Verifica regole di trading
    const newSignal = checkSignal();

    // Aggiorna timer e segnali
    updateTimer(newSignal);

    // Calcola indicatori per report
    const indicators = {
        linreg: calculateLinReg(),
        bb: calculateBollingerBands(),
        macd: calculateMACD(),
        ema: ema(config.emaLength),
        sma: sma(config.smaLength),
        rsi: rsi(config.rsiLength)
    };

    return {
        signal: currentSignal,
        signalStartIndex,
        indicators,
        timer: {
            current: timerCount,
            max: config.timerPeriods,
            active: currentSignal !== "NONE"
        }
    };
}

// =================== FUNZIONI AUSILIARIE ===================

export function getCurrentState() {
    const lastPrice = state.prices.length > 0 ? state.prices[state.prices.length - 1] : null;
    return {
        signal: currentSignal,
        timerCount,
        signalStartIndex,
        lastCandle: {
            open: state.opens.length > 0 ? state.opens[state.opens.length - 1] : null,
            high: state.highs.length > 0 ? state.highs[state.highs.length - 1] : null,
            low: state.lows.length > 0 ? state.lows[state.lows.length - 1] : null,
            close: lastPrice,
            volume: state.volumes.length > 0 ? state.volumes[state.volumes.length - 1] : null,
            timestamp: state.timestamps.length > 0 ? state.timestamps[state.timestamps.length - 1] : null
        }
    };
}

export function resetState() {
    state.opens = [];
    state.highs = [];
    state.lows = [];
    state.prices = [];
    state.volumes = [];
    state.timestamps = [];
    currentSignal = "NONE";
    timerCount = 0;
    signalStartIndex = -1;
}
