// logica.js - Versione definitiva con gestione errori avanzata

// =================== CONFIGURAZIONE ===================
const config = {
    linregLength: 100,
    bbLength: 20,
    emaLength: 21,
    smaLength: 50,
    rsiLength: 14,
    timerPeriods: 12
};

// Stato globale con valori predefiniti
const state = {
    prices: [],
    highs: [],
    lows: [],
    opens: [],
    volumes: [],
    timestamps: [],
    lastUpdate: null
};

// Stato del segnale
let currentSignal = "NONE";
let timerCount = 0;
let signalStartTimestamp = null;  // Memorizziamo il timestamp invece dell'indice

// =================== FUNZIONI SICURE PER INDICATORI ===================
function getSafeArrayValue(array, index) {
    return array && array.length > index ? array[index] : null;
}

function safeSMA(period) {
    if (state.prices.length < period) return null;
    const prices = state.prices.slice(-period);
    return prices.reduce((sum, val) => sum + val, 0) / period;
}

function safeEMA(period) {
    if (state.prices.length < period) return null;
    
    let ema = safeSMA(period);
    const alpha = 2 / (period + 1);
    
    for (let i = period; i < state.prices.length; i++) {
        const price = getSafeArrayValue(state.prices, i);
        if (price === null) break;
        ema = (price - ema) * alpha + ema;
    }
    
    return ema;
}

function safeRSI(period) {
    if (state.prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    // Calcola guadagni/perdite iniziali
    for (let i = 1; i <= period; i++) {
        const prev = getSafeArrayValue(state.prices, i - 1);
        const curr = getSafeArrayValue(state.prices, i);
        if (prev === null || curr === null) return 50;
        
        const change = curr - prev;
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    // Calcola RSI scorrevole
    for (let i = period + 1; i < state.prices.length; i++) {
        const prev = getSafeArrayValue(state.prices, i - 1);
        const curr = getSafeArrayValue(state.prices, i);
        if (prev === null || curr === null) break;
        
        const change = curr - prev;
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

function safeLinReg() {
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

function safeBollingerBands() {
    if (state.prices.length < config.bbLength) return { position: 0 };
    
    const prices = state.prices.slice(-config.bbLength);
    const basis = prices.reduce((sum, val) => sum + val, 0) / config.bbLength;
    
    const deviations = prices.map(p => Math.pow(p - basis, 2));
    const stdDev = Math.sqrt(deviations.reduce((sum, val) => sum + val, 0) / config.bbLength);
    
    const upper = basis + 2 * stdDev;
    const lower = basis - 2 * stdDev;
    const currentPrice = state.prices[state.prices.length - 1] || 0;
    const position = (currentPrice - lower) / (upper - lower);
    
    return { position, upper, lower, basis, currentPrice };
}

function safeMACD() {
    if (state.prices.length < config.emaLength + 1) return { histogram: 0 };
    
    const emaFast = safeEMA(config.emaLength);
    const emaSlow = safeEMA(config.smaLength);
    
    if (emaFast === null || emaSlow === null) return { histogram: 0 };
    return { histogram: emaFast - emaSlow };
}

// =================== GESTIONE SEGNALI SICURA ===================
function safeCheckSignal() {
    try {
        const emaValue = safeEMA(config.emaLength);
        const smaValue = safeSMA(config.smaLength);
        const rsiValue = safeRSI(config.rsiLength);
        
        if (emaValue === null || smaValue === null) return "NONE";
        
        if (emaValue > smaValue && rsiValue > 50) return "BUY";
        if (emaValue < smaValue && rsiValue < 50) return "SELL";
        return "NONE";
    } catch {
        return "NONE";
    }
}

function safeUpdateTimer(newSignal, candleTimestamp) {
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

// =================== CORE: PROCESSAMENTO CANDELA ===================
export function processNewCandle(candle) {
    try {
        // Aggiunta sicura dei valori
        state.opens.push(candle.open);
        state.highs.push(candle.high);
        state.lows.push(candle.low);
        state.prices.push(candle.close);
        state.volumes.push(candle.volume);
        state.timestamps.push(candle.timestamp);
        state.lastUpdate = Date.now();

        // Mantenimento dimensione ottimale
        const maxSize = Math.max(
            config.linregLength, 
            config.bbLength, 
            config.smaLength
        ) + 100;
        
        if (state.prices.length > maxSize) {
            state.opens.shift();
            state.highs.shift();
            state.lows.shift();
            state.prices.shift();
            state.volumes.shift();
            state.timestamps.shift();
        }

        // Calcolo segnale e timer
        const newSignal = safeCheckSignal();
        safeUpdateTimer(newSignal, candle.timestamp);

        return {
            signal: currentSignal,
            signalStartTimestamp,
            timerCount,
            indicators: {
                linreg: safeLinReg(),
                bb: safeBollingerBands(),
                macd: safeMACD(),
                ema: safeEMA(config.emaLength),
                sma: safeSMA(config.smaLength),
                rsi: safeRSI(config.rsiLength),
                currentPrice: candle.close,
                candles: state.prices.length
            }
        };
    } catch (error) {
        console.error("Errore critico in processNewCandle:", error);
        return {
            signal: "NONE",
            indicators: {}
        };
    }
}

// =================== FUNZIONI AUSILIARIE ===================
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
            linreg: safeLinReg(),
            bb: safeBollingerBands(),
            macd: safeMACD(),
            ema: safeEMA(config.emaLength),
            sma: safeSMA(config.smaLength),
            rsi: safeRSI(config.rsiLength),
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
