// logica.js - Versione robusta e sicura

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

let currentSignal = "NONE";
let timerCount = 0;
let signalStartTimestamp = null;

// Funzioni indicatori sicure
function sma(period) {
    if (state.prices.length < period) return null;
    return state.prices.slice(-period).reduce((sum, val) => sum + val, 0) / period;
}

function ema(period) {
    if (state.prices.length < period) return null;
    let ema = sma(period);
    const alpha = 2 / (period + 1);
    for (let i = period; i < state.prices.length; i++) {
        ema = (state.prices[i] - ema) * alpha + ema;
    }
    return ema;
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

function linreg() {
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

function bollingerBands() {
    if (state.prices.length < config.bbLength) return { position: 0 };
    const prices = state.prices.slice(-config.bbLength);
    const basis = prices.reduce((sum, val) => sum + val, 0) / config.bbLength;
    const stdDev = Math.sqrt(prices.map(p => Math.pow(p - basis, 2)).reduce((sum, val) => sum + val, 0) / config.bbLength);
    const upper = basis + 2 * stdDev;
    const lower = basis - 2 * stdDev;
    const currentPrice = state.prices[state.prices.length - 1] || 0;
    const position = (currentPrice - lower) / (upper - lower);
    return { position, upper, lower, basis, currentPrice };
}

function macd() {
    if (state.prices.length < config.emaLength + 1) return { histogram: 0 };
    const emaFast = ema(config.emaLength);
    const emaSlow = ema(config.smaLength);
    if (emaFast === null || emaSlow === null) return { histogram: 0 };
    return { histogram: emaFast - emaSlow };
}

function checkSignal() {
    const emaValue = ema(config.emaLength);
    const smaValue = sma(config.smaLength);
    const rsiValue = rsi(config.rsiLength);
    if (emaValue === null || smaValue === null) return "NONE";
    if (emaValue > smaValue && rsiValue > 50) return "BUY";
    if (emaValue < smaValue && rsiValue < 50) return "SELL";
    return "NONE";
}

function updateTimer(newSignal, candleTimestamp) {
    if (newSignal === "NONE") {
        timerCount = 0;
        currentSignal = "NONE";
        signalStartTimestamp = null;
    } else if (currentSignal === "NONE") {
        currentSignal = newSignal;
        timerCount = 1;
        signalStartTimestamp = candleTimestamp;
    } else if (newSignal !== currentSignal) {
        currentSignal = newSignal;
        timerCount = 1;
        signalStartTimestamp = candleTimestamp;
    } else {
        if (timerCount < config.timerPeriods) timerCount++;
        else {
            currentSignal = "NONE";
            timerCount = 0;
            signalStartTimestamp = null;
        }
    }
}

export function processNewCandle(candle) {
    try {
        // Aggiungi candela
        state.opens.push(candle.open);
        state.highs.push(candle.high);
        state.lows.push(candle.low);
        state.prices.push(candle.close);
        state.volumes.push(candle.volume);
        state.timestamps.push(candle.timestamp);
        state.lastUpdate = Date.now();

        // Mantieni dimensione massima
        const maxSize = Math.max(config.linregLength, config.bbLength, config.smaLength) + 100;
        if (state.prices.length > maxSize) {
            state.opens.shift();
            state.highs.shift();
            state.lows.shift();
            state.prices.shift();
            state.volumes.shift();
            state.timestamps.shift();
        }

        // Calcola segnale e timer
        const newSignal = checkSignal();
        updateTimer(newSignal, candle.timestamp);

        return {
            signal: currentSignal,
            signalStartTimestamp,
            timerCount,
            indicators: {
                linreg: linreg(),
                bb: bollingerBands(),
                macd: macd(),
                ema: ema(config.emaLength),
                sma: sma(config.smaLength),
                rsi: rsi(config.rsiLength),
                currentPrice: candle.close,
                candles: state.prices.length
            }
        };
    } catch (error) {
        console.error("Errore in processNewCandle:", error);
        return {
            signal: "NONE",
            indicators: {}
        };
    }
}

export function getCurrentState() {
    const lastCandle = state.prices.length > 0 ? {
        open: state.opens[state.opens.length - 1],
        high: state.highs[state.highs.length - 1],
        low: state.lows[state.lows.length - 1],
        close: state.prices[state.prices.length - 1],
        volume: state.volumes[state.volumes.length - 1],
        timestamp: state.timestamps[state.timestamps.length - 1]
    } : {};

    return {
        signal: currentSignal,
        timerCount,
        signalStartTimestamp,
        lastCandle,
        indicators: {
            linreg: linreg(),
            bb: bollingerBands(),
            macd: macd(),
            ema: ema(config.emaLength),
            sma: sma(config.smaLength),
            rsi: rsi(config.rsiLength),
            currentPrice: state.prices[state.prices.length - 1] || 0,
            candles: state.prices.length
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
    signalStartTimestamp = null;
    state.lastUpdate = null;
}
