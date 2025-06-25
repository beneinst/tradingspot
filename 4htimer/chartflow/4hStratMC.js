/**
 * Strategia Multi-Confluenza 4H
 * Traduzione da Pine Script a JavaScript per TradingView Lightweight Charts
 */

class MultiConfluenceStrategy {
    constructor(config = {}) {
        // ========== INIZIALIZZA VARIABILI ==========
        this.confluence_score = 0.0;
        this.conflu = null;
        this.extendLeftInput = false;   // Fisso: non estendere a sinistra
        this.extendRightInput = true;   // Fisso: estendere a destra
        
        // ========== IMPOSTAZIONI E VALORI ==========
        
        // Impostazioni Regressione Lineare 
        this.lengthInput = config.lengthInput || 100;
        this.sourceInput = config.sourceInput || 'close';  // 'close', 'open', 'high', 'low'
        this.linreg_sensitivity = config.linreg_sensitivity || 0.8;
        
        // Impostazioni Canale
        this.useUpperDevInput = config.useUpperDevInput !== undefined ? config.useUpperDevInput : true;
        this.upperMultInput = config.upperMultInput || 1.0;
        this.useLowerDevInput = config.useLowerDevInput !== undefined ? config.useLowerDevInput : true;
        this.lowerMultInput = config.lowerMultInput || 1.0;
        
        // Impostazioni Segnale
        this.use_bb_filter = config.use_bb_filter !== undefined ? config.use_bb_filter : true;
        this.use_pivot_filter = config.use_pivot_filter !== undefined ? config.use_pivot_filter : true;
        this.use_stoch_rsi_filter = config.use_stoch_rsi_filter !== undefined ? config.use_stoch_rsi_filter : true;
        this.use_ma_cross_filter = config.use_ma_cross_filter !== undefined ? config.use_ma_cross_filter : true;
        this.use_momentum_filter = config.use_momentum_filter !== undefined ? config.use_momentum_filter : true;
        this.use_price_action_filter = config.use_price_action_filter !== undefined ? config.use_price_action_filter : true;
        this.min_pearson = config.min_pearson || 0.5;
        this.use_macd_filter = config.use_macd_filter !== undefined ? config.use_macd_filter : true;
        
        // Impostazioni Stochastic RSI
        this.stoch_rsi_length = config.stoch_rsi_length || 14;
        this.stoch_rsi_rsi_length = config.stoch_rsi_rsi_length || 14;
        this.stoch_rsi_k = config.stoch_rsi_k || 1;
        this.stoch_rsi_d = config.stoch_rsi_d || 2;
        this.stoch_oversold = config.stoch_oversold || 20;
        this.stoch_overbought = config.stoch_overbought || 80;
        
        // Impostazioni Medie Mobili
        this.ema_length = config.ema_length || 21;
        this.sma_length = config.sma_length || 50;
        this.rsi_momentum_length = config.rsi_momentum_length || 14;
        this.volume_avg_length = config.volume_avg_length || 20;
        
        // Impostazioni Momentum
        this.momentum_length = config.momentum_length || 10;
        this.roc_length = config.roc_length || 12;
        this.williams_r_length = config.williams_r_length || 14;
        this.cci_length = config.cci_length || 20;
        
        // Impostazioni MACD
        this.macd_fast_length = config.macd_fast_length || 12;
        this.macd_slow_length = config.macd_slow_length || 26;
        this.macd_signal_length = config.macd_signal_length || 9;
        
        // Impostazioni Price Action
        this.atr_length = config.atr_length || 14;
        this.engulfing_lookback = config.engulfing_lookback || 2;
        this.doji_threshold = config.doji_threshold || 0.1;
        
        // Impostazioni Bande di Bollinger
        this.bb_length = config.bb_length || 20;
        this.bb_maType = config.bb_maType || 'SMA'; // 'SMA', 'EMA', 'SMMA', 'WMA', 'VWMA'
        this.bb_mult = config.bb_mult || 2.0;
        
        // Impostazioni Punti Pivot
        this.pivot_length = config.pivot_length || 9;
        this.show_reg = config.show_reg !== undefined ? config.show_reg : true;
        
        // Impostazioni Regressione Lineare aggiuntive
        this.min_pearson_for_linreg = config.min_pearson_for_linreg || 0.2;
        
        // Arrays per memorizzare i dati storici
        this.data = [];
        this.indicators = {};
        this.pivotData = {
            recent_ph: null,
            recent_pl: null,
            recent_ph_bar: null,
            recent_pl_bar: null
        };
    }
    
    // ========== UTILITY FUNCTIONS ==========
    
    /**
     * Calcola la Simple Moving Average (SMA)
     */
    calculateSMA(values, period) {
        if (values.length < period) return null;
        
        const sum = values.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }
    
    /**
     * Calcola l'Exponential Moving Average (EMA)
     */
    calculateEMA(values, period) {
        if (values.length === 0) return null;
        if (values.length === 1) return values[0];
        
        const multiplier = 2 / (period + 1);
        let ema = values[0];
        
        for (let i = 1; i < values.length; i++) {
            ema = (values[i] * multiplier) + (ema * (1 - multiplier));
        }
        
        return ema;
    }
    
    /**
     * Calcola il RSI (Relative Strength Index)
     */
    calculateRSI(values, period) {
        if (values.length < period + 1) return null;
        
        const changes = [];
        for (let i = 1; i < values.length; i++) {
            changes.push(values[i] - values[i - 1]);
        }
        
        const gains = changes.map(change => change > 0 ? change : 0);
        const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);
        
        const avgGain = this.calculateSMA(gains.slice(-period), period);
        const avgLoss = this.calculateSMA(losses.slice(-period), period);
        
        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
    
    /**
     * Calcola la Standard Deviation
     */
    calculateStdDev(values, period, mean = null) {
        if (values.length < period) return null;
        
        const slice = values.slice(-period);
        const avg = mean || this.calculateSMA(slice, period);
        
        const squaredDiffs = slice.map(value => Math.pow(value - avg, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
        
        return Math.sqrt(variance);
    }
    
    /**
     * Calcola la Regressione Lineare
     */
    calculateLinearRegression(values, length) {
        if (values.length < length) return null;
        
        const slice = values.slice(-length);
        let sumX = 0, sumY = 0, sumXSqr = 0, sumXY = 0;
        
        for (let i = 0; i < length; i++) {
            const val = slice[length - 1 - i]; // Reverse order to match Pine Script
            const per = i + 1;
            sumX += per;
            sumY += val;
            sumXSqr += per * per;
            sumXY += val * per;
        }
        
        const slope = (length * sumXY - sumX * sumY) / (length * sumXSqr - sumX * sumX);
        const average = sumY / length;
        const intercept = average - slope * sumX / length + slope;
        
        const startPrice = intercept + slope * (length - 1);
        const endPrice = intercept;
        
        return { slope, average, intercept, startPrice, endPrice };
    }
    
    /**
     * Calcola la deviazione della Regressione Lineare
     */
    calculateLinRegDev(values, length, slope, average, intercept) {
        if (values.length < length) return null;
        
        const slice = values.slice(-length);
        const highs = this.data.slice(-length).map(c => c.high);
        const lows = this.data.slice(-length).map(c => c.low);
        
        let upDev = 0, dnDev = 0, stdDevAcc = 0, dsxx = 0, dsyy = 0, dsxy = 0;
        const periods = length - 1;
        const daY = intercept + slope * periods / 2;
        let val = intercept;
        
        for (let j = 0; j < length; j++) {
            let price = highs[length - 1 - j] - val;
            if (price > upDev) upDev = price;
            
            price = val - lows[length - 1 - j];
            if (price > dnDev) dnDev = price;
            
            price = slice[length - 1 - j];
            const dxt = price - average;
            const dyt = val - daY;
            price = price - val;
            stdDevAcc += price * price;
            dsxx += dxt * dxt;
            dsyy += dyt * dyt;
            dsxy += dxt * dyt;
            val += slope;
        }
        
        const stdDev = Math.sqrt(stdDevAcc / (periods === 0 ? 1 : periods));
        const pearsonR = dsxx === 0 || dsyy === 0 ? 0 : dsxy / Math.sqrt(dsxx * dsyy);
        
        return { stdDev, pearsonR, upDev, dnDev };
    }
    
    /**
     * Aggiorna la Regressione Lineare
     */
    updateLinearRegression(values) {
        const linreg = this.calculateLinearRegression(values, this.lengthInput);
        if (!linreg) return;
        
        const { slope, average, intercept, startPrice, endPrice } = linreg;
        const dev = this.calculateLinRegDev(values, this.lengthInput, slope, average, intercept);
        
        if (dev) {
            const { stdDev, pearsonR } = dev;
            
            // Calcola posizione LinReg normalizzata
            const linreg_position = stdDev > 0 ? 
                Math.max(-1, Math.min(1, (values[values.length - 1] - endPrice) / (stdDev * this.lowerMultInput))) : 0;
            
            // Filtro per Pearson R
            const linreg_position_filtered = pearsonR >= this.min_pearson_for_linreg ? linreg_position : null;
            const linreg_label = pearsonR >= this.min_pearson_for_linreg ? 
                linreg_position.toFixed(2) : "NEUTRO";
            
            this.indicators.linreg = {
                slope,
                average,
                intercept,
                startPrice,
                endPrice,
                stdDev,
                pearsonR,
                position: linreg_position_filtered,
                label: linreg_label,
                upperLine: endPrice + (this.useUpperDevInput ? this.upperMultInput * stdDev : dev.upDev),
                lowerLine: endPrice + (this.useLowerDevInput ? -this.lowerMultInput * stdDev : -dev.dnDev)
            };
        }
    }
    
    /**
     * Calcola diverse tipologie di medie mobili
     */
    calculateMA(values, length, type) {
        switch (type) {
            case 'SMA':
                return this.calculateSMA(values, length);
            case 'EMA':
                return this.calculateEMA(values, length);
            case 'SMMA':
            case 'RMA':
                return this.calculateRMA(values, length);
            case 'WMA':
                return this.calculateWMA(values, length);
            case 'VWMA':
                return this.calculateVWMA(values, length);
            default:
                return this.calculateSMA(values, length);
        }
    }
    
    /**
     * Calcola RMA (Running Moving Average / SMMA)
     */
    calculateRMA(values, length) {
        if (values.length < length) return null;
        
        let rma = this.calculateSMA(values.slice(0, length), length);
        
        for (let i = length; i < values.length; i++) {
            rma = (rma * (length - 1) + values[i]) / length;
        }
        
        return rma;
    }
    
    /**
     * Calcola WMA (Weighted Moving Average)
     */
    calculateWMA(values, length) {
        if (values.length < length) return null;
        
        const slice = values.slice(-length);
        let weightedSum = 0;
        let weightSum = 0;
        
        for (let i = 0; i < length; i++) {
            const weight = i + 1;
            weightedSum += slice[i] * weight;
            weightSum += weight;
        }
        
        return weightedSum / weightSum;
    }
    
    /**
     * Calcola VWMA (Volume Weighted Moving Average)
     */
    calculateVWMA(values, length) {
        if (values.length < length || this.data.length < length) return null;
        
        const priceSlice = values.slice(-length);
        const volumeSlice = this.data.slice(-length).map(c => c.volume);
        
        let weightedSum = 0;
        let volumeSum = 0;
        
        for (let i = 0; i < length; i++) {
            weightedSum += priceSlice[i] * volumeSlice[i];
            volumeSum += volumeSlice[i];
        }
        
        return volumeSum > 0 ? weightedSum / volumeSum : null;
    }
    
    /**
     * Aggiorna le Bande di Bollinger
     */
    updateBollingerBands(values) {
        const basis = this.calculateMA(values, this.bb_length, this.bb_maType);
        if (!basis) return;
        
        const stdDev = this.calculateStdDev(values, this.bb_length, basis);
        if (!stdDev) return;
        
        const dev = this.bb_mult * stdDev;
        const upper = basis + dev;
        const lower = basis - dev;
        
        // Calcola posizione BB (-1 to +1)
        const currentClose = values[values.length - 1];
        const bb_position = (currentClose - lower) / (upper - lower) * 2 - 1;
        
        this.indicators.bb = {
            basis,
            upper,
            lower,
            stdDev,
            position: bb_position
        };
    }
    
    /**
     * Trova Pivot High
     */
    findPivotHigh(highs, length, index) {
        if (index < length || index >= highs.length - length) return null;
        
        const centerHigh = highs[index];
        
        // Controlla se è un massimo locale
        for (let i = index - length; i <= index + length; i++) {
            if (i !== index && highs[i] >= centerHigh) {
                return null;
            }
        }
        
        return centerHigh;
    }
    
    /**
     * Trova Pivot Low
     */
    findPivotLow(lows, length, index) {
        if (index < length || index >= lows.length - length) return null;
        
        const centerLow = lows[index];
        
        // Controlla se è un minimo locale
        for (let i = index - length; i <= index + length; i++) {
            if (i !== index && lows[i] <= centerLow) {
                return null;
            }
        }
        
        return centerLow;
    }
    
    /**
     * Aggiorna i Punti Pivot
     */
    updatePivotPoints() {
        if (this.data.length < this.pivot_length * 2 + 1) return;
        
        const highs = this.data.map(c => c.high);
        const lows = this.data.map(c => c.low);
        const currentIndex = this.data.length - 1 - this.pivot_length;
        
        if (currentIndex >= this.pivot_length) {
            // Cerca Pivot High
            const ph = this.findPivotHigh(highs, this.pivot_length, currentIndex);
            if (ph !== null) {
                this.pivotData.recent_ph = ph;
                this.pivotData.recent_ph_bar = currentIndex;
            }
            
            // Cerca Pivot Low
            const pl = this.findPivotLow(lows, this.pivot_length, currentIndex);
            if (pl !== null) {
                this.pivotData.recent_pl = pl;
                this.pivotData.recent_pl_bar = currentIndex;
            }
        }
        
        this.indicators.pivots = {
            recent_high: this.pivotData.recent_ph,
            recent_low: this.pivotData.recent_pl,
            recent_high_bar: this.pivotData.recent_ph_bar,
            recent_low_bar: this.pivotData.recent_pl_bar
        };
    }
    
    /**
     * Aggiunge una nuova candela ai dati
     */
    addCandle(candle) {
        // candle format: { time, open, high, low, close, volume }
        this.data.push(candle);
        
        // Mantieni solo gli ultimi 500 valori per performance
        if (this.data.length > 500) {
            this.data.shift();
        }
        
        this.updateIndicators();
    }
    
    /**
     * Aggiorna tutti gli indicatori
     */
    updateIndicators() {
        if (this.data.length === 0) return;
        
        const closes = this.data.map(candle => candle.close);
        const highs = this.data.map(candle => candle.high);
        const lows = this.data.map(candle => candle.low);
        const volumes = this.data.map(candle => candle.volume);
        
        // Calcola le medie mobili
        this.indicators.ema21 = this.calculateEMA(closes, this.ema_length);
        this.indicators.sma50 = this.calculateSMA(closes, this.sma_length);
        
        // Calcola RSI
        this.indicators.rsi = this.calculateRSI(closes, this.rsi_momentum_length);
        
        // Calcola ATR
        this.indicators.atr = this.calculateATR(this.data, this.atr_length);
        
        // Calcola Regressione Lineare
        this.updateLinearRegression(closes);
        
        // Calcola Bande di Bollinger
        this.updateBollingerBands(closes);
        
        // Calcola Punti Pivot
        this.updatePivotPoints();
        
        // Calcola trend generale
        if (this.indicators.ema21 && this.indicators.sma50) {
            const currentClose = closes[closes.length - 1];
            this.indicators.trend_bullish = this.indicators.ema21 > this.indicators.sma50 && currentClose > this.indicators.ema21;
            this.indicators.trend_bearish = this.indicators.ema21 < this.indicators.sma50 && currentClose < this.indicators.ema21;
        }
    }
    
    /**
     * Ottiene lo stato corrente degli indicatori
     */
    getIndicators() {
        return this.indicators;
    }
    
    /**
     * Ottiene i dati per il plotting (compatibile con TradingView Lightweight Charts)
     */
    getPlotData() {
        const latestCandle = this.data[this.data.length - 1];
        if (!latestCandle) return null;
        
        return {
            time: latestCandle.time,
            ema21: this.indicators.ema21,
            sma50: this.indicators.sma50,
            trend_bullish: this.indicators.trend_bullish,
            trend_bearish: this.indicators.trend_bearish
        };
    }
}

// Esempio di utilizzo:
/*
const strategy = new MultiConfluenceStrategy({
    ema_length: 21,
    sma_length: 50,
    // altri parametri...
});

// Aggiungi candele
strategy.addCandle({
    time: 1640995200, // timestamp
    open: 100,
    high: 105,
    low: 98,
    close: 103,
    volume: 1000
});

// Ottieni indicatori
const indicators = strategy.getIndicators();
console.log(indicators);
*/

export default MultiConfluenceStrategy;