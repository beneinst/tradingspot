 // === CONFIGURAZIONI E VARIABILI GLOBALI ===
        const CONFIG = {
            updateInterval: 5000, // 5 secondi
            dataPoints: 50,
            apiEndpoint: '/api/indicators', // Placeholder per API reale
            symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'] // Esempio simboli
        };

        let currentSymbol = 'BTCUSDT';
        let indicators = {};
        let priceData = [];
        let updateTimer = null;

        // === SIMULAZIONE DATI (da sostituire con API reale) ===
        function generateMockPriceData(length = 50) {
            const data = [];
            let price = 50000 + Math.random() * 10000;
            
            for (let i = 0; i < length; i++) {
                price += (Math.random() - 0.5) * 1000;
                price = Math.max(price, 30000); // Prezzo minimo
                
                data.push({
                    timestamp: Date.now() - (length - i) * 60000,
                    open: price + (Math.random() - 0.5) * 500,
                    high: price + Math.random() * 1000,
                    low: price - Math.random() * 1000,
                    close: price,
                    volume: 1000000 + Math.random() * 5000000
                });
            }
            return data;
        }

        // === CALCOLI INDICATORI TECNICI ===
        class TechnicalIndicators {
            static calculateRSI(prices, period = 14) {
                if (prices.length < period + 1) return null;
                
                let gains = 0;
                let losses = 0;
                
                // Primo calcolo
                for (let i = 1; i <= period; i++) {
                    const change = prices[i] - prices[i - 1];
                    if (change >= 0) {
                        gains += change;
                    } else {
                        losses -= change;
                    }
                }
                
                let avgGain = gains / period;
                let avgLoss = losses / period;
                
                // Calcolo RSI
                if (avgLoss === 0) return 100;
                const rs = avgGain / avgLoss;
                const rsi = 100 - (100 / (1 + rs));
                
                return {
                    value: rsi,
                    level: rsi > 70 ? 'Ipercomprato' : rsi < 30 ? 'Ipervenduto' : 'Neutrale',
                    trend: rsi > 50 ? 'Rialzista' : 'Ribassista',
                    signal: rsi > 70 ? 'SELL' : rsi < 30 ? 'BUY' : 'HOLD'
                };
            }

            static calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
                if (prices.length < slowPeriod) return null;
                
                const emaFast = this.calculateEMA(prices, fastPeriod);
                const emaSlow = this.calculateEMA(prices, slowPeriod);
                
                if (!emaFast || !emaSlow) return null;
                
                const macdLine = emaFast - emaSlow;
                const signalLine = this.calculateEMA([macdLine], signalPeriod) || 0;
                const histogram = macdLine - signalLine;
                
                return {
                    macd: macdLine,
                    signal: signalLine,
                    histogram: histogram,
                    trend: macdLine > signalLine ? 'Rialzista' : 'Ribassista',
                    signalType: histogram > 0 && macdLine > signalLine ? 'BUY' : 
                               histogram < 0 && macdLine < signalLine ? 'SELL' : 'HOLD'
                };
            }

            static calculateEMA(prices, period) {
                if (prices.length < period) return null;
                
                const multiplier = 2 / (period + 1);
                let ema = prices[0];
                
                for (let i = 1; i < prices.length; i++) {
                    ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
                }
                
                return ema;
            }

            static calculateSMA(prices, period) {
                if (prices.length < period) return null;
                
                const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
                return sum / period;
            }

            static calculateBollingerBands(prices, period = 20, stdDev = 2) {
                if (prices.length < period) return null;
                
                const sma = this.calculateSMA(prices, period);
                const recentPrices = prices.slice(-period);
                
                // Calcolo deviazione standard
                const variance = recentPrices.reduce((acc, price) => {
                    return acc + Math.pow(price - sma, 2);
                }, 0) / period;
                
                const standardDeviation = Math.sqrt(variance);
                
                const upperBand = sma + (standardDeviation * stdDev);
                const lowerBand = sma - (standardDeviation * stdDev);
                const currentPrice = prices[prices.length - 1];
                
                let signal = 'HOLD';
                if (currentPrice > upperBand) signal = 'SELL';
                if (currentPrice < lowerBand) signal = 'BUY';
                
                return {
                    upper: upperBand,
                    middle: sma,
                    lower: lowerBand,
                    position: currentPrice > sma ? 'Sopra' : 'Sotto',
                    signal: signal
                };
            }

            static calculateStochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
                if (closes.length < kPeriod) return null;
                
                const recentHighs = highs.slice(-kPeriod);
                const recentLows = lows.slice(-kPeriod);
                const currentClose = closes[closes.length - 1];
                
                const highestHigh = Math.max(...recentHighs);
                const lowestLow = Math.min(...recentLows);
                
                const kPercent = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
                
                // Semplificazione per %D (normalmente è una SMA di %K)
                const dPercent = kPercent * 0.9; // Approssimazione
                
                let signal = 'HOLD';
                if (kPercent > 80) signal = 'SELL';
                if (kPercent < 20) signal = 'BUY';
                
                return {
                    k: kPercent,
                    d: dPercent,
                    level: kPercent > 80 ? 'Ipercomprato' : kPercent < 20 ? 'Ipervenduto' : 'Neutrale',
                    signal: signal
                };
            }
        }

        // === FUNZIONI DI AGGIORNAMENTO UI ===
        function updateIndicatorCard(indicatorId, data) {
            const card = document.getElementById(`${indicatorId}-card`);
            if (!card) return;
            
            card.classList.remove('loading');
            
            // Aggiorna valore principale
            const valueElement = document.getElementById(`${indicatorId}-value`);
            if (valueElement && data.value !== undefined) {
                valueElement.textContent = typeof data.value === 'number' ? 
                    data.value.toFixed(2) : data.value;
                    
                // Aggiorna classe CSS per colore
                valueElement.className = `indicator-value ${getSignalClass(data.signal || 'HOLD')}`;
            }
            
            // Aggiorna dettagli specifici per ogni indicatore
            updateIndicatorDetails(indicatorId, data);
            
            // Aggiorna segnale
            updateSignalIndicator(indicatorId, data.signal || 'HOLD');
        }

        function updateIndicatorDetails(indicatorId, data) {
            switch (indicatorId) {
                case 'rsi':
                    updateElementText('rsi-level', data.level || '--');
                    updateElementText('rsi-trend', data.trend || '--');
                    break;
                    
                case 'macd':
                    updateElementText('macd-signal-value', data.signal?.toFixed(4) || '--');
                    updateElementText('macd-histogram', data.histogram?.toFixed(4) || '--');
                    break;
                    
                case 'ma':
                    updateElementText('ma20-value', data.ma20?.toFixed(2) || '--');
                    updateElementText('ma50-value', data.ma50?.toFixed(2) || '--');
                    break;
                    
                case 'bb':
                    updateElementText('bb-upper', data.upper?.toFixed(2) || '--');
                    updateElementText('bb-lower', data.lower?.toFixed(2) || '--');
                    break;
                    
                case 'stoch':
                    updateElementText('stoch-k', data.k?.toFixed(2) || '--');
                    updateElementText('stoch-d', data.d?.toFixed(2) || '--');
                    break;
                    
                case 'volume':
                    updateElementText('volume-avg', formatVolume(data.average) || '--');
                    updateElementText('volume-change', `${data.change?.toFixed(1) || '--'}%`);
                    break;
            }
        }

        function updateSignalIndicator(indicatorId, signal) {
            const signalElement = document.getElementById(`${indicatorId}-signal`);
            if (!signalElement) return;
            
            const signalConfig = {
                'BUY': { class: 'signal-buy', icon: '📈', text: 'Segnale BUY' },
                'STRONG_BUY': { class: 'signal-strong-buy', icon: '🚀', text: 'STRONG BUY' },
                'SELL': { class: 'signal-sell', icon: '📉', text: 'Segnale SELL' },
                'STRONG_SELL': { class: 'signal-strong-sell', icon: '🔻', text: 'STRONG SELL' },
                'HOLD': { class: 'signal-hold', icon: '⏸️', text: 'HOLD' }
            };
            
            const config = signalConfig[signal] || signalConfig['HOLD'];
            signalElement.className = `signal-indicator ${config.class}`;
            signalElement.innerHTML = `<span>${config.icon}</span> ${config.text}`;
        }

        function updateElementText(elementId, text) {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = text;
            }
        }

        function getSignalClass(signal) {
    switch (signal) {
        case 'BUY':
        case 'STRONG_BUY':
            return 'bullish';
        case 'SELL':
        case 'STRONG_SELL':
            return 'bearish';
        default:
            return 'neutral';
    }
}

function formatVolume(volume) {
    if (!volume) return '--';
    if (volume >= 1e9) return (volume / 1e9).toFixed(2) + 'B';
    if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M';
    if (volume >= 1e3) return (volume / 1e3).toFixed(2) + 'K';
    return volume.toString();
}

function formatPrice(price) {
    if (!price) return '--';
    return parseFloat(price).toFixed(2);
}

function formatPercentage(value) {
    if (!value && value !== 0) return '--';
    const num = parseFloat(value);
    const sign = num >= 0 ? '+' : '';
    return sign + num.toFixed(2) + '%';
}

function calculatePriceChange(currentPrice, previousPrice) {
    if (!currentPrice || !previousPrice) return null;
    return ((currentPrice - previousPrice) / previousPrice) * 100;
}

function getMarketStatus(timestamp) {
    const now = new Date();
    const marketTime = new Date(timestamp);
    const timeDiff = now - marketTime;
    
    // Se i dati sono più vecchi di 30 minuti, considera il mercato chiuso
    if (timeDiff > 30 * 60 * 1000) {
        return 'closed';
    }
    
    // Controlla se è in orario di mercato (9:30-16:00 EST nei giorni feriali)
    const hour = marketTime.getHours();
    const day = marketTime.getDay();
    
    if (day === 0 || day === 6) return 'closed'; // Weekend
    if (hour < 9 || (hour === 9 && marketTime.getMinutes() < 30)) return 'premarket';
    if (hour >= 16) return 'afterhours';
    
    return 'open';
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    
    return date.toLocaleDateString();
}

function validateSymbol(symbol) {
    if (!symbol || typeof symbol !== 'string') return false;
    // Simboli azionari tipici: 1-5 caratteri, solo lettere
    return /^[A-Z]{1,5}$/.test(symbol.toUpperCase());
}

function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return null;
    
    let gains = 0;
    let losses = 0;
    
    // Calcola i guadagni e le perdite iniziali
    for (let i = 1; i <= period; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) {
            gains += change;
        } else {
            losses += Math.abs(change);
        }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function getSignalStrength(rsi, volume, priceChange) {
    let strength = 'NEUTRAL';
    
    if (rsi > 70 && priceChange > 5) {
        strength = volume > 1000000 ? 'STRONG_SELL' : 'SELL';
    } else if (rsi < 30 && priceChange < -5) {
        strength = volume > 1000000 ? 'STRONG_BUY' : 'BUY';
    } else if (priceChange > 3) {
        strength = 'BUY';
    } else if (priceChange < -3) {
        strength = 'SELL';
    }
    
    return strength;
}

function formatMarketCap(marketCap) {
    if (!marketCap) return '--';
    if (marketCap >= 1e12) return (marketCap / 1e12).toFixed(2) + 'T';
    if (marketCap >= 1e9) return (marketCap / 1e9).toFixed(2) + 'B';
    if (marketCap >= 1e6) return (marketCap / 1e6).toFixed(2) + 'M';
    return marketCap.toString();
}

function isVolatile(priceHistory) {
    if (!priceHistory || priceHistory.length < 5) return false;
    
    const changes = [];
    for (let i = 1; i < priceHistory.length; i++) {
        const change = Math.abs((priceHistory[i] - priceHistory[i-1]) / priceHistory[i-1]);
        changes.push(change);
    }
    
    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    return avgChange > 0.05; // 5% di volatilità media
}

function getTrendDirection(prices) {
    if (!prices || prices.length < 3) return 'UNKNOWN';
    
    const recent = prices.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];
    
    const change = (last - first) / first;
    
    if (change > 0.02) return 'UPTREND';
    if (change < -0.02) return 'DOWNTREND';
    return 'SIDEWAYS';
}