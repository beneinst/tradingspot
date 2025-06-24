// index.js - Versione migliorata con migliore gestione errori

import { processNewCandle, loadState, getStateInfo, resetState } from './logica.js';

// ================= CONFIGURAZIONE =================
const CONFIG = {
    symbol: 'BTCUSDT',
    interval: '4h',
    wsUrl: 'wss://stream.binance.com:9443/ws/',
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

// ================= GESTIONE ERRORI MIGLIORATA =================

function handleApiError(error, context) {
    debugError(`Errore API in ${context}`, error);
    
    if (error.message.includes('429')) {
        debugError('Rate limit raggiunto, attendere prima di riprovare');
        return { type: 'rate_limit', retry: true, delay: 60000 };
    }
    
    if (error.message.includes('Network')) {
        debugError('Problema di connessione di rete');
        return { type: 'network', retry: true, delay: 5000 };
    }
    
    return { type: 'generic', retry: false };
}

// ================= GESTIONE DATI STORICI MIGLIORATA =================

async function fetchHistoricalDataWithRetry(symbol, interval, limit = 200, retries = 3) {
    const url = `${CONFIG.apiUrl}?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            debugLog(`Tentativo ${attempt}/${retries} - Recupero dati storici per ${symbol}`);
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'TradingApp/1.0'
                },
                timeout: 10000
            });
            
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

function validateCandle(candle, source = 'unknown') {
    const errors = [];
    
    // Controlli di base
    if (!candle || typeof candle !== 'object') {
        errors.push('Candela non è un oggetto valido');
        return { valid: false, errors };
    }
    
    // Controlli numerici
    const requiredFields = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];
    for (const field of requiredFields) {
        if (!(field in candle)) {
            errors.push(`Campo mancante: ${field}`);
        } else if (field === 'timestamp') {
            if (!Number.isInteger(candle[field]) || candle[field] <= 0) {
                errors.push(`Timestamp non valido: ${candle[field]}`);
            }
        } else {
            if (typeof candle[field] !== 'number' || isNaN(candle[field]) || candle[field] < 0) {
                errors.push(`Valore non valido per ${field}: ${candle[field]}`);
            }
        }
    }
    
    // Controlli logici OHLC
    if (errors.length === 0) {
        const { open, high, low, close } = candle;
        
        if (high < low) {
            errors.push(`High (${high}) < Low (${low})`);
        }
        if (close < low || close > high) {
            errors.push(`Close (${close}) fuori range [${low}, ${high}]`);
        }
        if (open < low || open > high) {
            errors.push(`Open (${open}) fuori range [${low}, ${high}]`);
        }
    }
    
    if (errors.length > 0) {
        debugError(`Validazione candela fallita (${source})`, { candle, errors });
        return { valid: false, errors };
    }
    
    return { valid: true, errors: [] };
}

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
        
        const validation = validateCandle(candle, `historical-${index}`);
        
        if (!validation.valid) {
            return { candle: null, error: validation.errors.join(', ') };
        }
        
        return { candle, error: null };
        
    } catch (error) {
        return { candle: null, error: `Errore parsing: ${error.message}` };
    }
}

async function initializeHistoricalData(symbol, interval) {
    try {
        debugLog('=== INIZIALIZZAZIONE DATI STORICI ===');
        
        // Controlla se abbiamo già dati validi
        const stateInfo = getStateInfo(symbol.toLowerCase());
        if (stateInfo && stateInfo.candles > 50) {
            debugLog('Dati esistenti sufficienti trovati', stateInfo);
            return { success: true, loaded: stateInfo.candles, processed: 0 };
        }
        
        // Recupera dati freschi
        const rawData = await fetchHistoricalDataWithRetry(symbol, interval, CONFIG.historyLimit);
        
        let processedCount = 0;
        let errorCount = 0;
        const errors = [];
        
        debugLog(`Processando ${rawData.length} candele storiche...`);
        
        // Processa in batch per migliori performance
        const batchSize = 50;
        for (let i = 0; i < rawData.length; i += batchSize) {
            const batch = rawData.slice(i, Math.min(i + batchSize, rawData.length));
            
            for (let j = 0; j < batch.length; j++) {
                const globalIndex = i + j;
                const result = parseHistoricalCandle(batch[j], globalIndex);
                
                if (result.error) {
                    errorCount++;
                    errors.push(`Candela ${globalIndex}: ${result.error}`);
                    continue;
                }
                
                const processResult = processNewCandle(result.candle, symbol.toLowerCase());
                
                if (processResult && !processResult.error) {
                    processedCount++;
                } else if (processResult && processResult.error !== 'insufficient_data') {
                    errorCount++;
                    errors.push(`Processing candela ${globalIndex}: ${processResult.error}`);
                }
            }
            
            // Log progresso
            if ((i + batchSize) % 100 === 0 || i + batchSize >= rawData.length) {
                debugLog(`Progresso: ${Math.min(i + batchSize, rawData.length)}/${rawData.length} candele elaborate`);
            }
        }
        
        const finalState = getStateInfo(symbol.toLowerCase());
        
        debugLog('=== RISULTATO INIZIALIZZAZIONE ===', {
            totali: rawData.length,
            processate: processedCount,
            errori: errorCount,
            statoFinale: finalState
        });
        
        if (errorCount > 0 && CONFIG.debugMode) {
            debugLog('Errori dettagliati:', errors.slice(0, 10)); // Mostra solo primi 10
        }
        
        return {
            success: processedCount > 0,
            total: rawData.length,
            processed: processedCount,
            errors: errorCount,
            state: finalState
        };
        
    } catch (error) {
        debugError('Errore critico nell\'inizializzazione dati storici', error);
        return { success: false, error: error.message };
    }
}

// ================= GESTIONE WEBSOCKET MIGLIORATA =================

function parseWebSocketCandle(klineData) {
    try {
        if (!klineData || !klineData.k) {
            return { candle: null, error: 'Dati kline mancanti' };
        }
        
        const k = klineData.k;
        
        const candle = {
            timestamp: parseInt(k.t),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
            closed: k.x === true
        };
        
        const validation = validateCandle(candle, 'websocket');
        
        if (!validation.valid) {
            return { candle: null, error: validation.errors.join(', ') };
        }
        
        return { candle, error: null };
        
    } catch (error) {
        return { candle: null, error: `Parsing error: ${error.message}` };
    }
}

function handleWebSocketMessage(event) {
    try {
        const data = JSON.parse(event.data);
        
        if (!data.k) {
            debugLog('Messaggio WebSocket ignorato (no kline)', data);
            return;
        }
        
        const parseResult = parseWebSocketCandle(data);
        
        if (parseResult.error) {
            debugError('Errore parsing WebSocket', parseResult.error);
            return;
        }
        
        const candle = parseResult.candle;
        
        // Log periodico per candele in corso
        if (!candle.closed && Math.random() < 0.05) { // 5% chance
            debugLog('Candela in corso', {
                symbol: data.k.s,
                close: candle.close,
                timestamp: new Date(candle.timestamp).toISOString()
            });
        }
        
        // Processa solo candele chiuse
        if (candle.closed) {
            debugLog('Nuova candela chiusa', {
                symbol: data.k.s,
                close: candle.close,
                volume: candle.volume,
                timestamp: new Date(candle.timestamp).toISOString()
            });
            
            if (!isInitialized) {
                debugLog('Sistema non ancora inizializzato, candela ignorata');
                return;
            }
            
            const processResult = processNewCandle(candle, data.k.s.toLowerCase());
            
            if (processResult && !processResult.error) {
                debugLog('✅ Candela processata', {
                    score: processResult.score,
                    bb: processResult.bb,
                    stochK: processResult.stochK,
                    candlesTotal: processResult.candles
                });
            } else {
                debugError('❌ Errore processing candela', processResult);
            }
        }
        
    } catch (error) {
        debugError('Errore elaborazione messaggio WebSocket', error);
    }
}

function connectWebSocket() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        debugLog('WebSocket già connesso');
        return;
    }
    
    const streamName = `${CONFIG.symbol.toLowerCase()}@kline_${CONFIG.interval}`;
    const wsUrl = `${CONFIG.wsUrl}${streamName}`;
    
    debugLog('Connessione WebSocket', { url: wsUrl, attempt: reconnectAttempts + 1 });
    
    websocket = new WebSocket(wsUrl);
    
    websocket.onopen = function() {
        debugLog(`✅ WebSocket connesso per ${CONFIG.symbol}`);
        reconnectAttempts = 0;
        updateConnectionStatus('CONNESSO');
    };
    
    websocket.onmessage = handleWebSocketMessage;
    
    websocket.onerror = function(error) {
        debugError('Errore WebSocket', error);
        updateConnectionStatus('ERRORE');
    };
    
    websocket.onclose = function(event) {
        debugLog('WebSocket disconnesso', { code: event.code, reason: event.reason });
        updateConnectionStatus('DISCONNESSO');
        
        // Riconnessione automatica solo se inizializzato
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
    
    // Aggiorna UI se presente
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = status;
        statusElement.className = `status ${status.toLowerCase()}`;
    }
    
    // Evento personalizzato per altri componenti
    window.dispatchEvent(new CustomEvent('connectionStatusChanged', {
        detail: { status, timestamp: Date.now() }
    }));
}

// ================= INIZIALIZZAZIONE PRINCIPALE =================

async function initializeApplication() {
    try {
        debugLog('🚀 AVVIO INIZIALIZZAZIONE APPLICAZIONE');
        
        const symbol = CONFIG.symbol.toLowerCase();
        
        // 1. Carica stato esistente
        debugLog('Caricamento stato esistente...');
        const stateLoaded = loadState(symbol);
        debugLog('Stato caricato', stateLoaded);
        
        // 2. Inizializza dati storici
        debugLog('Inizializzazione dati storici...');
        const historyResult = await initializeHistoricalData(CONFIG.symbol, CONFIG.interval);
        
        if (!historyResult.success) {
            throw new Error(`Inizializzazione dati storici fallita: ${historyResult.error}`);
        }
        
        debugLog('✅ Dati storici inizializzati', historyResult);
        
        // 3. Marca come inizializzato
        isInitialized = true;
        debugLog('✅ Sistema inizializzato correttamente');
        
        return true;
        
    } catch (error) {
        debugError('❌ Errore critico nell\'inizializzazione', error);
        isInitialized = false;
        return false;
    }
}

// ================= AVVIO APPLICAZIONE =================

async function startApplication() {
    try {
        debugLog('🎯 AVVIO APPLICAZIONE TRADING', {
            symbol: CONFIG.symbol,
            interval: CONFIG.interval,
            timestamp: new Date().toISOString()
        });
        
        // Inizializza sistema
        const initialized = await initializeApplication();
        
        if (!initialized) {
            debugError('❌ Inizializzazione fallita, impossibile continuare');
            updateConnectionStatus('ERRORE_INIT');
            return;
        }
        
        // Avvia WebSocket
        debugLog('Avvio connessione WebSocket...');
        connectWebSocket();
        
        debugLog('✅ APPLICAZIONE AVVIATA CON SUCCESSO');
        
        // Stato finale
        const finalState = getStateInfo(CONFIG.symbol.toLowerCase());
        debugLog('Stato finale sistema', finalState);
        
    } catch (error) {
        debugError('❌ ERRORE CRITICO NELL\'AVVIO', error);
        updateConnectionStatus('ERRORE_CRITICO');
    }
}

// ================= GESTIONE FINESTRA =================

window.addEventListener('beforeunload', function() {
    debugLog('Chiusura applicazione...');
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close();
    }
});

// Gestione visibilità pagina
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        debugLog('Pagina nascosta');
    } else {
        debugLog('Pagina visibile');
        // Riconnetti se necessario
        if (isInitialized && (!websocket || websocket.readyState !== WebSocket.OPEN)) {
            debugLog('Riconnessione dopo visibilità...');
            setTimeout(connectWebSocket, 1000);
        }
    }
});

// ================= AVVIO AUTOMATICO =================

// Avvia quando DOM è pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApplication);
} else {
    startApplication();
}

// ================= API PUBBLICA =================

window.tradingApp = {
    // Stato
    isInitialized: () => isInitialized,
    getConnectionStatus: () => connectionStatus,
    getStateInfo: () => getStateInfo(CONFIG.symbol.toLowerCase()),
    
    // Controlli
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
    
    // Debug
    enableDebug: () => { CONFIG.debugMode = true; },
    disableDebug: () => { CONFIG.debugMode = false; },
    
    // Reset
    resetState: () => {
        debugLog('Reset stato richiesto');
        resetState(CONFIG.symbol.toLowerCase());
        return getStateInfo(CONFIG.symbol.toLowerCase());
    }
};