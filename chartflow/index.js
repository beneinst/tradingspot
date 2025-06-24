import { processNewCandle, addTick, state } from './logica.js';

let socket = null;
let currentSymbol = 'btcusdc'; // Cambiato da btcusdt
let autoRefresh = false;
let refreshInterval = null;
let timerCount = 0;
let maxTimerCount = 6; // Default 6, può diventare 12
let lastSignalData = null;

// Mapping dei simboli per Binance API (diverso da quello mostrato)
const symbolMapping = {
    'adaeur': 'ADAEUR',
    'algoeur': 'ALGOEUR', 
    'avaxeur': 'AVAXEUR',
    'avaxusdc': 'AVAXUSDT', // Binance usa USDT invece di USDC
    'btcusdc': 'BTCUSDT',
    'dorusdc': 'DORUSDT',
    'etheur': 'ETHEUR',
    'fetusdc': 'FETUSDT',
    'ltceur': 'LTCEUR',
    'manaeur': 'MANAEUR',
    'nearusdc': 'NEARUSDT',
    'solusdc': 'SOLUSDT',
    'soleur': 'SOLEUR',
    'suiusdc': 'SUIUSDT',
    'uniusdc': 'UNIUSDT',
    'unieur': 'UNIEUR',
    'atomusdc': 'ATOMUSDT',
    'bnbusdc': 'BNBUSDT'
};

// Caricamento dati storici con supporto LocalStorage
async function loadHistoricalData(symbol) {
    const binanceSymbol = symbolMapping[symbol] || symbol.toUpperCase();
    const storageKey = `historicalData_${symbol}_4h`;
    
    try {
        // Prova a caricare da LocalStorage
        const savedData = localStorage.getItem(storageKey);
        const savedTimestamp = localStorage.getItem(`${storageKey}_timestamp`);
        
        const now = Date.now();
        const fourHoursAgo = now - (4 * 60 * 60 * 1000); // 4 ore fa
        
        // Se ho dati salvati e sono recenti (meno di 4 ore), li uso
        if (savedData && savedTimestamp && parseInt(savedTimestamp) > fourHoursAgo) {
            const data = JSON.parse(savedData);
            
            // Reset stato
            resetState();
            
            // Aggiungi dati storici
            data.forEach(candle => {
                addTick(
                    parseFloat(candle[1]), // open
                    parseFloat(candle[2]), // high
                    parseFloat(candle[3]), // low
                    parseFloat(candle[4])  // close
                );
            });
            
            console.log(`Dati storici 4H caricati da localStorage per ${symbol} (${data.length} candele)`);
            
            // Carica anche i dati del timer salvati
            loadTimerData(symbol);
            
            // Forza un aggiornamento della dashboard
            const calculations = processNewCandle(null); // null = no new candle, just recalculate
            if (calculations) {
                updateDashboard(calculations);
            }
            
            return;
        }
    } catch (error) {
        console.warn('Errore nel caricamento da localStorage:', error);
    }
    
    // Carica dati freschi dal server
    await fetchAndUpdateHistoricalData(symbol);
}

// Fetch dati storici da server
async function fetchAndUpdateHistoricalData(symbol) {
    const binanceSymbol = symbolMapping[symbol] || symbol.toUpperCase();
    
    try {
        console.log(`Caricamento dati storici per ${binanceSymbol}...`);
        
        const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=4h&limit=200`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Salva in localStorage
        const storageKey = `historicalData_${symbol}_4h`;
        localStorage.setItem(storageKey, JSON.stringify(data));
        localStorage.setItem(`${storageKey}_timestamp`, Date.now().toString());
        
        // Reset stato
        resetState();
        
        // Aggiungi dati storici
        data.forEach(candle => {
            addTick(
                parseFloat(candle[1]), // open
                parseFloat(candle[2]), // high
                parseFloat(candle[3]), // low
                parseFloat(candle[4])  // close
            );
        });
        
        console.log(`Dati storici 4H aggiornati da server per ${symbol} (${data.length} candele)`);
        
        // Forza calcolo iniziale
        const calculations = processNewCandle(null);
        if (calculations) {
            updateDashboard(calculations);
        }
        
    } catch (error) {
        console.error('Errore nel caricamento dati storici:', error);
        showError(`Errore caricamento dati per ${symbol}: ${error.message}`);
    }
}

// Reset dello stato
function resetState() {
    state.prices = [];
    state.highs = [];
    state.lows = [];
    state.opens = [];
    // Reset altri stati se necessario
}

// Connessione WebSocket Binance
function connectBinance(symbol) {
    if (socket) {
        socket.close();
        socket = null;
    }
    
    const binanceSymbol = symbolMapping[symbol] || symbol.toUpperCase();
    const wsUrl = `wss://stream.binance.com:9443/ws/${binanceSymbol.toLowerCase()}@kline_4h`;
    
    console.log(`Connessione WebSocket: ${wsUrl}`);
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
        console.log(`WebSocket connesso per ${binanceSymbol}`);
        updateConnectionStatus(true);
    };
    
    socket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            const candlestick = message.k;
            
            if (candlestick && candlestick.x) {  // candela chiusa (x = true)
                console.log('Nuova candela 4H ricevuta:', {
                    symbol: candlestick.s,
                    time: new Date(candlestick.t).toLocaleString(),
                    close: candlestick.c
                });
                
                const candle = {
                    time: candlestick.t,
                    open: parseFloat(candlestick.o),
                    high: parseFloat(candlestick.h),
                    low: parseFloat(candlestick.l),
                    close: parseFloat(candlestick.c),
                };
                
                // Processa la nuova candela
                const calculations = processNewCandle(candle);
                
                if (calculations) {
                    updateDashboard(calculations);
                    
                    // Aggiorna il timer
                    updateTimer(calculations);
                    
                    // Salva dati aggiornati
                    saveCurrentData(symbol);
                }
            } else if (candlestick) {
                // Candela in corso (per debug)
                console.log('Candela in corso:', {
                    symbol: candlestick.s,
                    close: candlestick.c,
                    closed: candlestick.x
                });
            }
        } catch (error) {
            console.error('Errore elaborazione messaggio WebSocket:', error, event.data);
        }
    };
    
    socket.onclose = (event) => {
        console.log(`WebSocket chiuso per ${binanceSymbol}:`, event.code, event.reason);
        updateConnectionStatus(false);
        
        // Riconnessione automatica dopo 5 secondi
        setTimeout(() => {
            if (currentSymbol === symbol) { // Solo se non è cambiato simbolo
                console.log('Tentativo riconnessione...');
                connectBinance(symbol);
            }
        }, 5000);
    };
    
    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus(false);
    };
}

// Aggiorna stato connessione
function updateConnectionStatus(connected) {
    // Potresti aggiungere un indicatore visivo nella dashboard
    console.log('Stato connessione:', connected ? 'CONNESSO' : 'DISCONNESSO');
}

// Salva dati correnti in localStorage
function saveCurrentData(symbol) {
    try {
        // Salva i dati del timer
        const timerData = {
            count: timerCount,
            maxCount: maxTimerCount,
            lastSignal: lastSignalData,
            timestamp: Date.now()
        };
        
        localStorage.setItem(`timerData_${symbol}`, JSON.stringify(timerData));
        
        console.log('Dati timer salvati:', timerData);
    } catch (error) {
        console.error('Errore salvataggio dati:', error);
    }
}

// Carica dati timer da localStorage
function loadTimerData(symbol) {
    try {
        const saved = localStorage.getItem(`timerData_${symbol}`);
        if (saved) {
            const data = JSON.parse(saved);
            timerCount = data.count || 0;
            maxTimerCount = data.maxCount || 6;
            lastSignalData = data.lastSignal || null;
            
            console.log('Dati timer caricati:', data);
            
            // Aggiorna UI
            updateTimerUI();
        }
    } catch (error) {
        console.error('Errore caricamento dati timer:', error);
    }
}

// Aggiorna timer con nuovi calcoli
function updateTimer(calculations) {
    // Logica per determinare se è un segnale valido
    const isValidSignal = Math.abs(calculations.score) >= 0.5;
    
    if (isValidSignal) {
        // Reset timer se abbiamo un segnale valido
        timerCount = 0;
        lastSignalData = {
            type: calculations.score > 0 ? 'BUY' : 'SELL',
            score: calculations.score,
            time: new Date().toISOString()
        };
        
        console.log('Nuovo segnale valido:', lastSignalData);
    } else {
        // Incrementa timer
        timerCount++;
        
        // Se supera il massimo, reset
        if (timerCount > maxTimerCount) {
            timerCount = 0;
            lastSignalData = null;
        }
    }
    
    updateTimerUI();
}

// Aggiorna UI del timer
function updateTimerUI() {
    const timerStatus = document.getElementById('timerStatus');
    const timerFill = document.getElementById('timerFill');
    const timerProgress = document.getElementById('timerProgress');
    const lastSignalTime = document.getElementById('lastSignalTime');
    const lastSignalType = document.getElementById('lastSignalType');
    const barsElapsed = document.getElementById('barsElapsed');
    const barsRemaining = document.getElementById('barsRemaining');
    
    if (timerStatus) {
        timerStatus.textContent = lastSignalData ? 'TIMER OK' : 'NESSUN OK';
    }
    
    if (timerFill) {
        const percentage = (timerCount / maxTimerCount) * 100;
        timerFill.style.width = `${percentage}%`;
    }
    
    if (timerProgress) {
        timerProgress.textContent = `${timerCount}/${maxTimerCount}`;
    }
    
    if (lastSignalTime && lastSignalData) {
        lastSignalTime.textContent = new Date(lastSignalData.time).toLocaleString();
    }
    
    if (lastSignalType && lastSignalData) {
        lastSignalType.textContent = lastSignalData.type;
    }
    
    if (barsElapsed) {
        barsElapsed.textContent = timerCount.toString();
    }
    
    if (barsRemaining) {
        barsRemaining.textContent = (maxTimerCount - timerCount).toString();
    }
}

// Cambio simbolo
function changeSymbol() {
    const select = document.getElementById('cryptoSelect');
    const newSymbol = select.value;
    if (!newSymbol || newSymbol === currentSymbol) return;
    
    console.log(`Cambio simbolo da ${currentSymbol} a ${newSymbol}`);
    currentSymbol = newSymbol;
    
    showLoadingMessage(true, `Caricamento dati storici 4H per ${newSymbol}...`);
    
    loadHistoricalData(currentSymbol).then(() => {
        connectBinance(currentSymbol);
        showLoadingMessage(false);
    }).catch(error => {
        console.error('Errore cambio simbolo:', error);
        showLoadingMessage(false);
        showError(`Errore nel cambio simbolo: ${error.message}`);
    });
}

// Mostra messaggio di caricamento
function showLoadingMessage(show, message = '') {
    const loadingElem = document.getElementById('loadingMessage');
    if (!loadingElem) return;
    
    if (show) {
        loadingElem.textContent = message;
        loadingElem.style.display = 'block';
        loadingElem.style.color = '#ffe58f';
    } else {
        loadingElem.style.display = 'none';
    }
}

// Mostra errore
function showError(message) {
    const loadingElem = document.getElementById('loadingMessage');
    if (loadingElem) {
        loadingElem.textContent = `❌ ${message}`;
        loadingElem.style.display = 'block';
        loadingElem.style.color = '#f44336';
        
        // Nascondi dopo 5 secondi
        setTimeout(() => {
            loadingElem.style.display = 'none';
        }, 5000);
    }
}

// Aggiorna dashboard
function updateDashboard(calculations) {
    // Indicatori principali
    const linregValue = document.getElementById('linregValue');
    const pearsonValue = document.getElementById('pearsonValue');
    const bbValue = document.getElementById('bbValue');
    const stochValue = document.getElementById('stochValue');
    const confluenceScore = document.getElementById('confluenceScore');
    
    if (linregValue) linregValue.textContent = calculations.linreg.toFixed(2);
    if (pearsonValue) pearsonValue.textContent = calculations.pearson.toFixed(2);
    if (bbValue) bbValue.textContent = calculations.bb.toFixed(2);
    if (stochValue) stochValue.textContent = calculations.stoch.toFixed(2);
    
    // Confluence score
    if (confluenceScore) {
        confluenceScore.textContent = calculations.score.toFixed(2);
        
        // Aggiorna classe CSS
        confluenceScore.className = 'confluence-score';
        if (calculations.score > 0.5) {
            confluenceScore.classList.add('score-positive');
        } else if (calculations.score < -0.5) {
            confluenceScore.classList.add('score-negative');
        } else {
            confluenceScore.classList.add('score-neutral');
        }
    }
    
    // Segnale principale
    const mainSignal = document.getElementById('mainSignal');
    const signalStrength = document.getElementById('signalStrength');
    
    if (mainSignal && signalStrength) {
        signalStrength.textContent = Math.abs(calculations.score).toFixed(2);
        
        mainSignal.className = 'signal-status';
        if (calculations.score > 0.5) {
            mainSignal.classList.add('signal-buy');
            mainSignal.querySelector('span').textContent = 'SEGNALE BUY';
        } else if (calculations.score < -0.5) {
            mainSignal.classList.add('signal-sell');
            mainSignal.querySelector('span').textContent = 'SEGNALE SELL';
        } else {
            mainSignal.classList.add('signal-neutral');
            mainSignal.querySelector('span').textContent = 'IN ATTESA';
        }
    }
    
    // Ultimo aggiornamento
    const lastUpdate = document.getElementById('lastUpdate');
    if (lastUpdate) {
        lastUpdate.textContent = new Date().toLocaleTimeString();
    }
    
    console.log('Dashboard aggiornata:', {
        score: calculations.score,
        linreg: calculations.linreg,
        pearson: calculations.pearson
    });
}

// Refresh manuale
function refreshData() {
    console.log('Refresh manuale richiesto');
    showLoadingMessage(true, 'Aggiornamento dati...');
    
    fetchAndUpdateHistoricalData(currentSymbol).then(() => {
        showLoadingMessage(false);
    }).catch(error => {
        showLoadingMessage(false);
        showError(`Errore refresh: ${error.message}`);
    });
}

// Toggle auto refresh
function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    const btn = document.getElementById('autoRefreshBtn');
    
    if (autoRefresh) {
        refreshInterval = setInterval(() => {
            console.log('Auto refresh attivo');
            refreshData();
        }, 60000); // Ogni minuto
        
        if (btn) btn.textContent = '⏰ Auto Refresh: ON';
    } else {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        if (btn) btn.textContent = '⏰ Auto Refresh: OFF';
    }
}

// Cambia massimo timer (6 o 12)
function toggleTimerMax() {
    maxTimerCount = maxTimerCount === 6 ? 12 : 6;
    console.log(`Timer massimo cambiato a: ${maxTimerCount}`);
    
    // Reset timer se supera il nuovo massimo
    if (timerCount > maxTimerCount) {
        timerCount = 0;
        lastSignalData = null;
    }
    
    updateTimerUI();
    saveCurrentData(currentSymbol);
}

// Esporta funzioni globali
window.connectBinance = connectBinance;
window.changeSymbol = changeSymbol;
window.updateDashboard = updateDashboard;
window.refreshData = refreshData;
window.toggleAutoRefresh = toggleAutoRefresh;
window.toggleTimerMax = toggleTimerMax;
window.showLoadingMessage = showLoadingMessage;

// Inizializzazione
window.addEventListener('DOMContentLoaded', () => {
    console.log('Inizializzazione dashboard...');
    
    // Imposta simbolo iniziale nella select
    const select = document.getElementById('cryptoSelect');
    if (select) {
        select.value = currentSymbol;
        select.addEventListener('change', changeSymbol);
    }
    
    // Carica dati e connetti
    showLoadingMessage(true, `Caricamento dati storici 4H per ${currentSymbol}...`);
    
    loadHistoricalData(currentSymbol).then(() => {
        connectBinance(currentSymbol);
        showLoadingMessage(false);
    }).catch(error => {
        console.error('Errore inizializzazione:', error);
        showLoadingMessage(false);
        showError(`Errore inizializzazione: ${error.message}`);
    });
});

// Gestione chiusura pagina
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.close();
    }
    
    // Salva dati prima di chiudere
    saveCurrentData(currentSymbol);
});