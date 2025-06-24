// logica.js - Traduzione da Java a JavaScript per la Strategia Multi-Confluenza

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
};

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
    if (state.prices.length < config.lengthInput) return null;

    const currentPrice = state.prices[state.prices.length - 1];

    const bbBasis = sma(state.prices, config.bbLength);
    const bbDev = config.bbMult * stdev(state.prices, config.bbLength);
    const bbUpper = bbBasis + bbDev;
    const bbLower = bbBasis - bbDev;
    const bbPosition = (currentPrice - bbLower) / (bbUpper - bbLower) * 2 - 1;

    const emaValue = ema(state.prices, config.emaLength);
    const smaValue = sma(state.prices, config.smaLength);
    const trendBullish = emaValue > smaValue && currentPrice > emaValue;
    const trendBearish = emaValue < smaValue && currentPrice < emaValue;

    let momentumBullish = false, momentumBearish = false;
    if (state.prices.length >= config.momentumLength + 1) {
        const momentum = currentPrice - state.prices[state.prices.length - config.momentumLength - 1];
        momentumBullish = momentum > 0;
        momentumBearish = momentum < 0;
    }

    const stochData = calcStochRsi();
    const stochK = stochData[0];
    const stochD = stochData[1];

    return {
        bbPosition,
        trendBullish,
        trendBearish,
        momentumBullish,
        momentumBearish,
        stochK,
        stochD,
    };
}

function calcStochRsi() {
    if (state.prices.length < Math.max(config.stochRsiRsiLength, config.stochRsiLength)) {
        return [50, 50];
    }

    const rsiValues = [];
    for (let i = config.stochRsiRsiLength; i < state.prices.length; i++) {
        const subset = state.prices.slice(i - config.stochRsiRsiLength, i + 1);
        rsiValues.push(rsi(subset, config.stochRsiRsiLength));
    }

    if (rsiValues.length < config.stochRsiLength) {
        return [50, 50];
    }

    const highestRsi = highest(rsiValues, config.stochRsiLength);
    const lowestRsi = lowest(rsiValues, config.stochRsiLength);
    const currentRsi = rsiValues[rsiValues.length - 1];

    const stochRsi = (highestRsi !== lowestRsi) ?
        100 * (currentRsi - lowestRsi) / (highestRsi - lowestRsi) : 50;

    return [stochRsi, stochRsi];
}

// ================= AGGIUNTA DATI =================

function addTick(open, high, low, close) {
    state.opens.push(open);
    state.highs.push(high);
    state.lows.push(low);
    state.prices.push(close);

    const maxSize = config.lengthInput + 50;
    if (state.prices.length > maxSize) {
        state.opens.shift();
        state.highs.shift();
        state.lows.shift();
        state.prices.shift();
    }
}

function processNewCandle(candle) {
    addTick(candle.open, candle.high, candle.low, candle.close);
    const result = calculateIndicators();
    if (!result) return null;

    return {
        linreg: 0,    // placeholder da calcolare se serve
        pearson: 0,   // placeholder da calcolare se serve
        bb: result.bbPosition,
        stoch: result.stochK,
        score: result.bbPosition // esempio di score, da personalizzare
    };
}

// ================= ESPORTAZIONE =================
export { addTick, calculateIndicators, state, config, processNewCandle };
