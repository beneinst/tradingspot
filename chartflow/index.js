// ================= CONFIGURAZIONE MULTI-SIMBOLO =================
import { processNewCandle, loadState, getStateInfo, resetState } from './logica.js';

const CONFIG = {
    symbols: [
        'ATOMUSDC', 'BTCUSDT', 'ETHEUR', 'FETUSDC', 'SOLUSDC', 'BNBUSDC',
        'ADAEUR', 'UNIUSDC', 'MANAEUR', 'LTCEUR', 'ALGOEUR', 'AVAXEUR',
        'AVAXUSDC', 'DOTUSDC', 'NEARUSDC', 'SUIUSDC'
    ],
    interval: '4h',
    wsUrl: 'wss://stream.binance.com:9443/stream?streams=',
    apiUrl: 'https://api.binance.com/api/v3/klines',
    maxRetries: 3,
    retryDelay: 5000,
    historyLimit: 200,
    debugMode: true
};

let websocket = null;
let reconnectAttempts = 0;
let connectionStatus = 'DISCONNESSO';
let isInitialized = false;

function changeSymbol(select) {
    const symbol = select.value.toUpperCase();
    debugLog(`Simbolo selezionato: ${symbol}`);
    initializeHistoricalDataForSymbol(symbol).then(() => {
        // Aggiorna la dashboard/grafico con i nuovi dati
        updateDashboard(symbol, getLastCandle(symbol));
    });
}


// ================= UTILITÀ DI DEBUG =================
function debugLog(message, data = null) {
    if (CONFIG.debugMode) {
        const timestamp = new Date().toISOString();
        if (data) {
            console.log(`[${timestamp}] ${message}`, data);
        } else {
            console.log(`[${timestamp}] ${message}`);
        }
    }
}

function debugError(message, error = null) {
    const timestamp = new Date().toISOString();
    if (error) {
        console.error(`[${timestamp}] ERROR: ${message}`, error);
    } else {
        console.error(`[${timestamp}] ERROR: ${message}`);
    }
}

// ================= GESTIONE DATI STORICI LOCALE =================
function saveCandlesToLocal(symbol, candles) {
    try {
        localStorage.setItem(`candles_${symbol}`, JSON.stringify(candles));
    } catch (e) {
        debugError(`Errore salvataggio localStorage per ${symbol}`, e);
    }
}

function loadCandlesFromLocal(symbol) {
    try {
        const data = localStorage.getItem(`candles_${symbol}`);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        debugError(`Errore caricamento localStorage per ${symbol}`, e);
        return null;
    }
}

// ================= GESTIONE ERRORI =================
function handleApiError(error, context) {
    debugError(`Errore API in ${context}`, error);

    if (error.message && error.message.includes('429')) {
        debugError('Rate limit raggiunto, attendere prima di riprovare');
        return { type: 'rate_limit', retry: true, delay: 60000 };
    }

    if (error.message && error.message.includes('Network')) {
        debugError('Problema di connessione di rete');
        return { type: 'network', retry: true, delay: 5000 };
    }

    return { type: 'generic', retry: false };
}

// ================= FETCH DATI STORICI =================
async function fetchHistoricalDataForSymbol(symbol, interval, limit) {
    const url = `${CONFIG.apiUrl}?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    let retries = CONFIG.maxRetries;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            debugLog(`Tentativo ${attempt}/${retries} - Recupero dati storici per ${symbol}`);
            const response = await fetch(url, { timeout: 10000 });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('Dati storici vuoti o formato non valido');
            }
            debugLog(`✅ Ricevute ${data.length} candele per ${symbol}`);
            return data;
        } catch (error) {
            const errorInfo = handleApiError(error, 'fetchHistoricalData');
            if (attempt === retries || !errorInfo.retry) {
                throw new Error(`Impossibile recuperare dati storici dopo ${retries} tentativi: ${error.message}`);
            }
            debugError(`Tentativo ${attempt} fallito, riprovo in ${errorInfo.delay}ms`);
            await new Promise(resolve => setTimeout(resolve, errorInfo.delay));
        }
    }
}

// ================= INIZIALIZZAZIONE DATI STORICI PER SIMBOLO =================
async function initializeHistoricalDataForSymbol(symbol) {
    try {
        debugLog(`[${symbol}] Inizializzazione dati storici...`);
        // 1. Caricamento locale
        let candles = loadCandlesFromLocal(symbol);
        if (candles && candles.length >= CONFIG.historyLimit) {
            debugLog(`[${symbol}] Dati storici caricati da localStorage`, { candles: candles.length });
            for (const candle of candles) {
                processNewCandle(candle, symbol.toLowerCase());
            }
            return { success: true, loaded: candles.length, source: 'local' };
        }

        // 2. Fetch da API
        const rawData = await fetchHistoricalDataForSymbol(symbol, CONFIG.interval, CONFIG.historyLimit);
        let parsedCandles = [];
        for (let i = 0; i < rawData.length; i++) {
            const result = parseHistoricalCandle(rawData[i], i);
            if (result.candle) parsedCandles.push(result.candle);
        }
        saveCandlesToLocal(symbol, parsedCandles);
        for (const candle of parsedCandles) {
            processNewCandle(candle, symbol.toLowerCase());
        }
        debugLog(`[${symbol}] ${parsedCandles.length} candele elaborate e salvate`);
        return { success: true, loaded: parsedCandles.length, source: 'api' };
    } catch (error) {
        debugError(`[${symbol}] Errore inizializzazione dati storici`, error);
        return { success: false, error: error.message };
    }
}

// ================= PARSING CANDELE =================
function parseHistoricalCandle(rawCandle, index) {
    try {
        if (!Array.isArray(rawCandle) || rawCandle.length < 6) {
            return { candle: null, error: `Formato array non valido (index: ${index})` };
        }
        const [timestamp, open, high, low, close, volume] = rawCandle;
        const candle = {
            timestamp: parseInt(timestamp),
            open: parseFloat(open),
            high: parseFloat(high),
            low: parseFloat(low),
            close: parseFloat(close),
            volume: parseFloat(volume)
        };
        // Validazione base
        if (isNaN(candle.timestamp) || isNaN(candle.open)) {
            return { candle: null, error: 'Valori non numerici' };
        }
        return { candle, error: null };
    } catch (error) {
        return { candle: null, error: `Errore parsing: ${error.message}` };
    }
}

// ================= WEBSOCKET MULTI-SIMBOLO =================
function buildCombinedStreamUrl() {
    const streams = CONFIG.symbols.map(
        symbol => `${symbol.toLowerCase()}@kline_${CONFIG.interval}`
    ).join('/');
    return `${CONFIG.wsUrl}${streams}`;
}

function parseWebSocketMessage(data) {
    try {
        const jsonData = JSON.parse(data);
        if (!jsonData.stream || !jsonData.data) return null;
        const symbol = jsonData.stream.split('@')[0].toUpperCase();
        const k = jsonData.data.k;
        return {
            symbol,
            candle: {
                timestamp: parseInt(k.t),
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
                volume: parseFloat(k.v),
                closed: k.x
            }
        };
    } catch (error) {
        debugError('Errore parsing messaggio WebSocket', error);
        return null;
    }
}

function handleWebSocketMessage(event) {
    const parsed = parseWebSocketMessage(event.data);
    if (!parsed) return;
    const { symbol, candle } = parsed;
    debugLog(`[${symbol}] Ricevuta candela`, candle);

    // Aggiorna localStorage solo se candela chiusa
    if (candle.closed) {
        processNewCandle(candle, symbol.toLowerCase());
        // Aggiorna localStorage
        let candles = loadCandlesFromLocal(symbol) || [];
        candles.push(candle);
        if (candles.length > CONFIG.historyLimit) candles = candles.slice(-CONFIG.historyLimit);
        saveCandlesToLocal(symbol, candles);
        updateDashboard(symbol, candle); // Implementa questa funzione per la UI
    }
}

// ================= DASHBOARD PLACEHOLDER =================
function updateDashboard(symbol, candle) {
    // Da implementare: aggiorna la UI per il simbolo specifico
    debugLog(`[UI] Aggiornamento ${symbol}: ${candle.close}`);
}

// ================= INIZIALIZZAZIONE MULTI-SIMBOLO =================
async function initializeApplication() {
    try {
        debugLog('🚀 AVVIO INIZIALIZZAZIONE APPLICAZIONE');
        await Promise.all(CONFIG.symbols.map(symbol =>
            initializeHistoricalDataForSymbol(symbol)
        ));
        isInitialized = true;
        debugLog('✅ Sistema inizializzato correttamente');
        return true;
    } catch (error) {
        debugError('❌ Errore critico nell\'inizializzazione', error);
        isInitialized = false;
        return false;
    }
}

// ================= WEBSOCKET CONNECTION =================
function connectWebSocket() {
    if (websocket) websocket.close();
    const wsUrl = buildCombinedStreamUrl();
    debugLog(`Connessione WebSocket combinata: ${wsUrl}`);
    websocket = new WebSocket(wsUrl);

    websocket.onopen = function () {
        debugLog(`✅ WebSocket combinato connesso`);
        reconnectAttempts = 0;
        updateConnectionStatus('CONNESSO');
    };

    websocket.onmessage = handleWebSocketMessage;

    websocket.onerror = function (error) {
        debugError('Errore WebSocket', error);
        updateConnectionStatus('ERRORE');
    };

    websocket.onclose = function (event) {
        debugLog('WebSocket disconnesso', { code: event.code, reason: event.reason });
        updateConnectionStatus('DISCONNESSO');
        if (isInitialized && reconnectAttempts < CONFIG.maxRetries) {
            reconnectAttempts++;
            debugLog(`Riconnessione ${reconnectAttempts}/${CONFIG.maxRetries} in ${CONFIG.retryDelay}ms`);
            setTimeout(connectWebSocket, CONFIG.retryDelay);
        } else if (reconnectAttempts >= CONFIG.maxRetries) {
            debugError('Numero massimo di tentativi di riconnessione raggiunto');
        }
    };
}

function updateConnectionStatus(status) {
    connectionStatus = status;
    debugLog('Stato connessione aggiornato', status);
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = status;
        statusElement.className = `status ${status.toLowerCase()}`;
    }
    window.dispatchEvent(new CustomEvent('connectionStatusChanged', {
        detail: { status, timestamp: Date.now() }
    }));
}

// ================= AVVIO APPLICAZIONE =================
async function startApplication() {
    try {
        debugLog('🎯 AVVIO APPLICAZIONE TRADING', {
            symbols: CONFIG.symbols,
            interval: CONFIG.interval,
            timestamp: new Date().toISOString()
        });
        const initialized = await initializeApplication();
        if (!initialized) {
            debugError('❌ Inizializzazione fallita, impossibile continuare');
            updateConnectionStatus('ERRORE_INIT');
            return;
        }
        debugLog('Avvio connessione WebSocket...');
        connectWebSocket();
        debugLog('✅ APPLICAZIONE AVVIATA CON SUCCESSO');
    } catch (error) {
        debugError('❌ ERRORE CRITICO NELL\'AVVIO', error);
        updateConnectionStatus('ERRORE_CRITICO');
    }
}

// ================= GESTIONE FINESTRA =================
window.addEventListener('beforeunload', function () {
    debugLog('Chiusura applicazione...');
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close();
    }
});

document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        debugLog('Pagina nascosta');
    } else {
        debugLog('Pagina visibile');
        if (isInitialized && (!websocket || websocket.readyState !== WebSocket.OPEN)) {
            debugLog('Riconnessione dopo visibilità...');
            setTimeout(connectWebSocket, 1000);
        }
    }
});

// ================= AVVIO AUTOMATICO =================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApplication);
} else {
    startApplication();
}

// ================= API PUBBLICA =================
window.tradingApp = {
    isInitialized: () => isInitialized,
    getConnectionStatus: () => connectionStatus,
    getStateInfo: (symbol) => getStateInfo(symbol ? symbol.toLowerCase() : CONFIG.symbols[0].toLowerCase()),
    reconnect: () => {
        debugLog('Riconnessione manuale richiesta');
        reconnectAttempts = 0;
        connectWebSocket();
    },
    restart: async () => {
        debugLog('Restart completo richiesto');
        if (websocket) websocket.close();
        isInitialized = false;
        reconnectAttempts = 0;
        await startApplication();
    },
    enableDebug: () => { CONFIG.debugMode = true; },
    disableDebug: () => { CONFIG.debugMode = false; },
    resetState: (symbol) => {
        debugLog('Reset stato richiesto');
        resetState(symbol ? symbol.toLowerCase() : CONFIG.symbols[0].toLowerCase());
        return getStateInfo(symbol ? symbol.toLowerCase() : CONFIG.symbols[0].toLowerCase());
    }
};
