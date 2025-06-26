// logica.js - Implementazione Sistema Multi-Confluence

// =================== CONFIGURAZIONE ===================
const config = {
    // Regressione Lineare (Filtro Primario)
    linregLength: 100,
    linregThreshold: 0.8,
    
    // Bollinger Bands
    bbLength: 20,
    bbMult: 2.0,
    
    // Stochastic RSI
    stochRsiLength: 14,
    stochOverbought: 70,
    stochOversold: 30,
    
    // Medie Mobili
    emaLength: 21,
    smaLength: 50,
    rsiLength: 14,
    
    // Momentum (4 componenti)
    momentumPeriods: [10, 12, 14, 20], // Momentum, ROC, Williams %R, CCI
    
    // Price Action
    atrLength: 14,
    
    // MACD
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    
    // Pivot Points
    pivotLookback: 9,
    pivotDistance: 0.03, // 3%
    
    // Timer
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

// Stato del segnale e timer
let currentSignal = "NONE";  // "BUY", "SELL", "NONE"
let signalStartIndex = -1;   // Indice candela di inizio segnale
let timerCount = 0;          // Conteggio corrente del timer

// =================== FUNZIONI INDICATORI ===================

// 1. Regressione Lineare (Filtro Primario)
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

// 2. Bande di Bollinger
function calculateBollingerBands() {
    if (state.prices.length < config.bbLength) return { position: 0 };
    const prices = state.prices.slice(-config.bbLength);
    const basis = prices.reduce((sum, val) => sum + val, 0) / config.bbLength;
    
    const deviations = prices.map(p => Math.pow(p - basis, 2));
    const stdDev = Math.sqrt(deviations.reduce((sum, val) => sum + val, 0) / config.bbLength);
    
    const upper = basis + config.bbMult * stdDev;
    const lower = basis - config.bbMult * stdDev;
    const currentPrice = state.prices[state.prices.length - 1];
    
    const position = (currentPrice - lower) / (upper - lower);
    return { position, upper, lower, basis };
}

// 3. Stochastic RSI
function calculateStochRSI() {
    if (state.prices.length < config.stochRsiLength) return { k: 50 };
    
    // Calcola RSI
    const rsiValues = [];
    for (let i = 1; i <= config.stochRsiLength; i++) {
        const gains = [];
        const losses = [];
        
        for (let j = state.prices.length - i; j > state.prices.length - i - config.stochRsiLength; j--) {
            if (j <= 0) break;
            const change = state.prices[j] - state.prices[j - 1];
            gains.push(Math.max(change, 0));
            losses.push(Math.max(-change, 0));
        }
        
        const avgGain = gains.reduce((a, b) => a + b, 0) / gains.length;
        const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsiValues.push(100 - (100 / (1 + rs)));
    }
    
    // Calcola Stochastic
    const currentRsi = rsiValues[rsiValues.length - 1];
    const lowestRsi = Math.min(...rsiValues);
    const highestRsi = Math.max(...rsiValues);
    
    const k = ((currentRsi - lowestRsi) / (highestRsi - lowestRsi)) * 100;
    return { k };
}

// 4. Medie Mobili e Trend
function calculateMATrend() {
    if (state.prices.length < config.smaLength) return { trend: 0 };
    
    // EMA 21
    const emaValues = [state.prices[0]];
    const emaAlpha = 2 / (config.emaLength + 1);
    for (let i = 1; i < state.prices.length; i++) {
        emaValues.push(emaAlpha * state.prices[i] + (1 - emaAlpha) * emaValues[i - 1]);
    }
    const ema = emaValues[emaValues.length - 1];
    
    // SMA 50
    const sma = state.prices.slice(-config.smaLength).reduce((a, b) => a + b, 0) / config.smaLength;
    
    // RSI
    const rsi = calculateRSI(config.rsiLength);
    
    // Trend
    const trend = ema > sma && rsi > 50 ? 1 : ema < sma && rsi < 55 ? -1 : 0;
    return { trend, ema, sma, rsi };
}

// 5. Momentum (4 componenti)
function calculateMomentum() {
    if (state.prices.length < Math.max(...config.momentumPeriods) + 1) return { score: 0 };
    
    // Momentum (10 periodi)
    const momentum = state.prices[state.prices.length - 1] - state.prices[state.prices.length - 11];
    
    // ROC (12 periodi)
    const roc = ((state.prices[state.prices.length - 1] - state.prices[state.prices.length - 13]) / 
                 state.prices[state.prices.length - 13]) * 100;
    
    // Williams %R (14 periodi)
    const high14 = Math.max(...state.highs.slice(-14));
    const low14 = Math.min(...state.lows.slice(-14));
    const williams = ((high14 - state.prices[state.prices.length - 1]) / (high14 - low14)) * -100;
    
    // CCI (20 periodi)
    const typicalPrices = [];
    for (let i = state.prices.length - 20; i < state.prices.length; i++) {
        typicalPrices.push((state.highs[i] + state.lows[i] + state.prices[i]) / 3);
    }
    const smaTP = typicalPrices.reduce((a, b) => a + b, 0) / 20;
    const meanDev = typicalPrices.map(tp => Math.abs(tp - smaTP)).reduce((a, b) => a + b, 0) / 20;
    const cci = (typicalPrices[19] - smaTP) / (0.015 * meanDev);
    
    // Punteggio complessivo
    const momentumScore = (momentum > 0 ? 1 : -1) + (roc > 0 ? 1 : -1) + 
                         (williams > -50 ? 1 : -1) + (cci > 0 ? 1 : -1);
    
    return { score: Math.sign(momentumScore), momentum, roc, williams, cci };
}

// 6. Price Action Patterns
function detectPriceAction() {
    if (state.opens.length < 3) return { pattern: 0 };
    
    const current = {
        open: state.opens[state.opens.length - 1],
        high: state.highs[state.highs.length - 1],
        low: state.lows[state.lows.length - 1],
        close: state.prices[state.prices.length - 1]
    };
    
    const prev1 = {
        open: state.opens[state.opens.length - 2],
        high: state.highs[state.highs.length - 2],
        low: state.lows[state.lows.length - 2],
        close: state.prices[state.prices.length - 2]
    };
    
    const prev2 = {
        open: state.opens[state.opens.length - 3],
        high: state.highs[state.highs.length - 3],
        low: state.lows[state.lows.length - 3],
        close: state.prices[state.prices.length - 3]
    };
    
    // Engulfing pattern
    if (current.close > current.open && prev1.close < prev1.open && 
        current.close > prev1.open && current.open < prev1.close) {
        return { pattern: 1, type: "Bullish Engulfing" };
    }
    
    if (current.close < current.open && prev1.close > prev1.open && 
        current.close < prev1.open && current.open > prev1.close) {
        return { pattern: -1, type: "Bearish Engulfing" };
    }
    
    // Hammer/Shooting Star
    const currentBody = Math.abs(current.close - current.open);
    const currentRange = current.high - current.low;
    const lowerShadow = current.open > current.close ? 
        current.close - current.low : current.open - current.low;
    
    if (lowerShadow >= 2 * currentBody && (current.high - Math.max(current.open, current.close)) <= currentBody) {
        return { pattern: 1, type: "Hammer" };
    }
    
    const upperShadow = current.open > current.close ? 
        current.high - current.open : current.high - current.close;
    
    if (upperShadow >= 2 * currentBody && (Math.min(current.open, current.close) - current.low) <= currentBody) {
        return { pattern: -1, type: "Shooting Star" };
    }
    
    return { pattern: 0, type: "No Pattern" };
}

// 7. MACD
function calculateMACD() {
    if (state.prices.length < config.macdSlow) return { histogram: 0 };
    
    // EMA veloce
    let emaFast = state.prices[0];
    const alphaFast = 2 / (config.macdFast + 1);
    for (let i = 1; i < state.prices.length; i++) {
        emaFast = alphaFast * state.prices[i] + (1 - alphaFast) * emaFast;
    }
    
    // EMA lenta
    let emaSlow = state.prices[0];
    const alphaSlow = 2 / (config.macdSlow + 1);
    for (let i = 1; i < state.prices.length; i++) {
        emaSlow = alphaSlow * state.prices[i] + (1 - alphaSlow) * emaSlow;
    }
    
    const macdLine = emaFast - emaSlow;
    
    // Segnale
    let signalLine = macdLine;
    const alphaSignal = 2 / (config.macdSignal + 1);
    for (let i = 1; i < state.prices.length; i++) {
        signalLine = alphaSignal * macdLine + (1 - alphaSignal) * signalLine;
    }
    
    return { histogram: macdLine - signalLine, macdLine, signalLine };
}

// 8. Punti Pivot
function calculatePivotPoints() {
    if (state.prices.length < config.pivotLookback) return { position: 0 };
    
    const highs = state.highs.slice(-config.pivotLookback);
    const lows = state.lows.slice(-config.pivotLookback);
    const closes = state.prices.slice(-config.pivotLookback);
    
    const high = Math.max(...highs);
    const low = Math.min(...lows);
    const close = closes[closes.length - 1];
    
    const pivot = (high + low + close) / 3;
    const support1 = (2 * pivot) - high;
    const resistance1 = (2 * pivot) - low;
    
    const currentPrice = state.prices[state.prices.length - 1];
    const distToSupport = Math.abs(currentPrice - support1) / currentPrice;
    const distToResistance = Math.abs(currentPrice - resistance1) / currentPrice;
    
    let position = 0;
    if (distToSupport <= config.pivotDistance) position = 1;
    else if (distToResistance <= config.pivotDistance) position = -1;
    
    return { position, pivot, support1, resistance1 };
}

// 9. Pearson R
function calculatePearsonR() {
    if (state.prices.length < config.linregLength) return 0;
    
    const prices = state.prices.slice(-config.linregLength);
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
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator !== 0 ? numerator / denominator : 0;
}

// =================== CALCOLO CONFLUENCE SCORE ===================
function calculateConfluenceScore() {
    // 1. Bollinger Bands
    const bb = calculateBollingerBands();
    const bbContribution = bb.position <= -0.7 ? 1 : bb.position >= 0.7 ? -1 : 0;
    
    // 2. Pivot Points
    const pivot = calculatePivotPoints();
    const pivotContribution = pivot.position;
    
    // 3. Stochastic RSI
    const stoch = calculateStochRSI();
    const stochContribution = stoch.k <= config.stochOversold ? 1 : 
                             stoch.k >= config.stochOverbought ? -1 : 0;
    
    // 4. Medie Mobili e Trend
    const ma = calculateMATrend();
    const maContribution = ma.trend * 0.5; // +0.5 o -0.5
    
    // 5. Momentum
    const momentum = calculateMomentum();
    const momentumContribution = momentum.score;
    
    // 6. Price Action
    const priceAction = detectPriceAction();
    const priceActionContribution = priceAction.pattern;
    
    // 7. MACD
    const macd = calculateMACD();
    const macdContribution = macd.histogram > 0 ? 1 : macd.histogram < 0 ? -1 : 0;
    
    // Calcolo punteggio totale
    const score = bbContribution + pivotContribution + stochContribution + 
                  maContribution + momentumContribution + priceActionContribution + 
                  macdContribution;
    
    return {
        score,
        components: {
            bb: bbContribution,
            pivot: pivotContribution,
            stoch: stochContribution,
            ma: maContribution,
            momentum: momentumContribution,
            priceAction: priceActionContribution,
            macd: macdContribution
        }
    };
}

// =================== REGOLE DI TRADING ===================
function checkTradingRules() {
    const linreg = calculateLinReg();
    const pearson = Math.abs(calculatePearsonR());
    const confluence = calculateConfluenceScore();
    const price = state.prices[state.prices.length - 1];
    
    // Condizioni obbligatorie per BUY
    if (linreg <= -config.linregThreshold && 
        confluence.score >= 0.5 && 
        pearson >= 0.5) {
        return "BUY";
    }
    
    // Condizioni obbligatorie per SELL
    if (linreg >= config.linregThreshold && 
        confluence.score <= -0.5 && 
        pearson >= 0.5) {
        return "SELL";
    }
    
    return "NONE";
}

// =================== GESTIONE TIMER ===================
function updateTimer() {
    // Reset timer se non c'è segnale attivo
    if (currentSignal === "NONE") {
        timerCount = 0;
        return;
    }
    
    // Incrementa timer
    timerCount++;
    
    // Disattiva timer dopo 12 candele
    if (timerCount >= config.timerPeriods) {
        currentSignal = "NONE";
        timerCount = 0;
        signalStartIndex = -1;
    }
}

function handleOppositeSignal(newSignal) {
    if ((currentSignal === "BUY" && newSignal === "SELL") || 
        (currentSignal === "SELL" && newSignal === "BUY")) {
        // Reset timer e inizia nuovo segnale
        timerCount = 1;
        currentSignal = newSignal;
        signalStartIndex = state.prices.length - 1;
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
    
    // Mantieni dimensioni massime
    const maxSize = Math.max(
        config.linregLength,
        config.bbLength,
        config.stochRsiLength,
        config.smaLength,
        ...config.momentumPeriods
    ) + 50;
    
    if (state.prices.length > maxSize) {
        state.opens.shift();
        state.highs.shift();
        state.lows.shift();
        state.prices.shift();
        state.volumes.shift();
        state.timestamps.shift();
    }
    
    // Verifica regole di trading
    const newSignal = checkTradingRules();
    
    // Gestione segnali e timer
    if (newSignal !== "NONE") {
        if (currentSignal === "NONE") {
            // Nuovo segnale
            currentSignal = newSignal;
            signalStartIndex = state.prices.length - 1;
            timerCount = 1;
        } else if (newSignal !== currentSignal) {
            // Segnale opposto
            handleOppositeSignal(newSignal);
        }
        // Ignora stesso segnale
    } else {
        // Aggiorna timer se segnale attivo
        if (currentSignal !== "NONE") {
            updateTimer();
        }
    }
    
    // Calcola indicatori per report
    const indicators = {
        linreg,
        pearsonR: calculatePearsonR(),
        confluence: calculateConfluenceScore(),
        bb: calculateBollingerBands(),
        stoch: calculateStochRSI(),
        ma: calculateMATrend(),
        momentum: calculateMomentum(),
        priceAction: detectPriceAction(),
        macd: calculateMACD(),
        pivot: calculatePivotPoints(),
        timer: {
            current: timerCount,
            max: config.timerPeriods,
            active: currentSignal !== "NONE"
        }
    };
    
    return {
        signal: currentSignal,
        signalStartIndex,
        indicators,
        timestamp: candle.timestamp,
        price: candle.close
    };
}

// =================== FUNZIONI AUSILIARIE ===================
export function getCurrentState() {
    return {
        signal: currentSignal,
        timerCount,
        signalStartIndex,
        lastCandle: {
            open: state.opens[state.opens.length - 1],
            high: state.highs[state.highs.length - 1],
            low: state.lows[state.lows.length - 1],
            close: state.prices[state.prices.length - 1],
            volume: state.volumes[state.volumes.length - 1],
            timestamp: state.timestamps[state.timestamps.length - 1]
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
