// index.js - Fix per gestione candele storiche

import { processNewCandle, loadState, getStateInfo } from './logica.js';

// ================= CONFIGURAZIONE =================
const CONFIG = {
    symbol: 'BTCUSDT',
    interval: '4h',
    wsUrl: 'wss://stream.binance.com:9443/ws/',
    apiUrl: 'https://api.binance.com/api/v3/klines',
    maxRetries: 3,
    retryDelay: 5000,
};

let websocket = null;
let reconnectAttempts = 0;
let connectionStatus = 'DISCONNESSO';

// ================= GESTIONE DATI STORICI (CORRETTA) =================

async function fetchHistoricalData(symbol, interval, limit = 200) {
    const url = `${CONFIG.apiUrl}?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    
    try {
        console.log(`Recupero dati storici per ${symbol} (${limit} candele)`);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('Nessun dato storico ricevuto');
        }
        
        console.log(`Ricevute ${data.length} candele storiche per ${symbol}`);
        return data;
        
    } catch (error) {
        console.error(`Errore nel recupero dati storici per ${symbol}:`, error);
        throw error;
    }
}

function parseHistoricalCandle(rawCandle) {
    try {
        // Formato Binance: [timestamp, open, high, low, close, volume, close_time, ...]
        if (!Array.isArray(rawCandle) || rawCandle.length < 6) {
            console.error('Formato candela storica non valido:', rawCandle);
            return null;
        }
        
        const [timestamp, open, high, low, close, volume] = rawCandle;
        
        // Conversione e validazione
        const candle = {
            timestamp: parseInt(timestamp),
            open: parseFloat(open),
            high: parseFloat(high),
            low: parseFloat(low),
            close: parseFloat(close),
            volume: parseFloat(volume)
        };
        
        // Validazione logica
        if (isNaN(candle.open) || isNaN(candle.high) || isNaN(candle.low) || isNaN(candle.close)) {
            console.error('Valori OHLC non numerici:', candle);
            return null;
        }
        
        if (candle.high < candle.low || candle.close < candle.low || candle.close > candle.high || 
            candle.open < candle.low || candle.open > candle.high) {
            console.error('Valori OHLC logicamente inconsistenti:', candle);
            return null;
        }
        
        return candle;
        
    } catch (error) {
        console.error('Errore nel parsing candela storica:', error, rawCandle);
        return null;
    }
}

async function fetchAndUpdateHistoricalData(symbol, interval) {
    try {
        const rawData = await fetchHistoricalData(symbol, interval);
        let processedCount = 0;
        let errorCount = 0;
        
        console.log(`Processando ${rawData.length} candele storiche...`);
        
        for (let i = 0; i < rawData.length; i++) {
            const rawCandle = rawData[i];
            const candle = parseHistoricalCandle(rawCandle);
            
            if (candle === null) {
                errorCount++;
                console.warn(`Candela ${i} saltata (formato non valido)`);
                continue;
            }
            
            // Processa la candela
            const result = processNewCandle(candle, symbol.toLowerCase());
            
            if (result && !result.error) {
                processedCount++;
            } else if (result && result.error === 'insufficient_data') {
                // Normale durante l'inizializzazione
            } else {
                errorCount++;
                console.warn(`Errore processing candela ${i}:`, result);
            }
        }
        
        console.log(`Dati storici ${interval} aggiornati da server per ${symbol}:`);
        console.log(`- Candele processate: ${processedCount}/${rawData.length}`);
        console.log(`- Errori: ${errorCount}`);
        console.log(`- Info stato:`, getStateInfo(symbol.toLowerCase()));
        
        return processedCount > 0;
        
    } catch (error) {
        console.error(`Errore nell'aggiornamento dati storici per ${symbol}:`, error);
        return false;
    }
}

// ================= GESTIONE WEBSOCKET (MIGLIORATA) =================

function parseWebSocketCandle(klineData) {
    try {
        if (!klineData || !klineData.k) {
            console.error('Dati kline WebSocket non validi:', klineData);
            return null;
        }
        
        const k = klineData.k;
        
        const candle = {
            timestamp: parseInt(k.t), // timestamp di apertura
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
            closed: k.x === true // se la candela è chiusa
        };
        
        // Validazione
        if (isNaN(candle.open) || isNaN(candle.high) || isNaN(candle.low) || isNaN(candle.close)) {
            console.error('Valori OHLC WebSocket non numerici:', candle);
            return null;
        }
        
        return candle;
        
    } catch (error) {
        console.error('Errore nel parsing candela WebSocket:', error, klineData);
        return null;
    }
}

function handleWebSocketMessage(event) {
    try {
        const data = JSON.parse(event.data);
        
        if (!data.k) {
            console.warn('Messaggio WebSocket senza dati kline:', data);
            return;
        }
        
        const candle = parseWebSocketCandle(data);
        
        if (!candle) {
            console.error('Impossibile parsare candela WebSocket');
            return;
        }
        
        // Log candele in corso (solo ogni 10 messaggi per non intasare)
        if (!candle.closed && Math.random() < 0.1) {
            console.log('Candela in corso:', {
                symbol: data.k.s,
                close: data.k.c,
                closed: candle.closed,
                timestamp: new Date(candle.timestamp).toISOString()
            });
        }
        
        // Processa solo candele chiuse per evitare ridondanza
        if (candle.closed) {
            console.log('Nuova candela chiusa ricevuta:', {
                symbol: data.k.s,
                close: candle.close,
                timestamp: new Date(candle.timestamp).toISOString()
            });
            
            const result = processNewCandle(candle, data.k.s.toLowerCase());
            
            if (result && !result.error) {
                console.log('Candela processata con successo:', {
                    score: result.score,
                    bb: result.bb,
                    stochK: result.stochK,
                    candles: result.candles
                });
            } else {
                console.warn('Errore nel processing candela WebSocket:', result);
            }
        }
        
    } catch (error) {
        console.error('Errore nell\'elaborazione messaggio WebSocket:', error);
    }
}

function connectWebSocket() {
    const streamName = `${CONFIG.symbol.toLowerCase()}@kline_${CONFIG.interval}`;
    const wsUrl = `${CONFIG.wsUrl}${streamName}`;
    
    console.log('Connessione WebSocket:', wsUrl);
    
    websocket = new WebSocket(wsUrl);
    
    websocket.onopen = function() {
        console.log(`WebSocket connesso per ${CONFIG.symbol}`);
        reconnectAttempts = 0;
        updateConnectionStatus('CONNESSO');
    };
    
    websocket.onmessage = handleWebSocketMessage;
    
    websocket.onerror = function(error) {
        console.error('Errore WebSocket:', error);
        updateConnectionStatus('ERRORE');
    };
    
    websocket.onclose = function(event) {
        console.log('WebSocket disconnesso:', event.code, event.reason);
        updateConnectionStatus('DISCONNESSO');
        
        // Riconnessione automatica
        if (reconnectAttempts < CONFIG.maxRetries) {
            reconnectAttempts++;
            console.log(`Tentativo di riconnessione ${reconnectAttempts}/${CONFIG.maxRetries} in ${CONFIG.retryDelay}ms`);
            setTimeout(connectWebSocket, CONFIG.retryDelay);
        } else {
            console.error('Numero massimo di tentativi di riconnessione raggiunto');
        }
    };
}

function updateConnectionStatus(status) {
    connectionStatus = status;
    console.log('Stato connessione:', status);
    
    // Aggiorna UI se presente
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = status;
        statusElement.className = `status ${status.toLowerCase()}`;
    }
}

// ================= INIZIALIZZAZIONE =================

async function loadHistoricalData() {
    try {
        console.log('=== INIZIALIZZAZIONE SISTEMA ===');
        
        // Carica stato salvato
        const stateLoaded = loadState(CONFIG.symbol.toLowerCase());
        console.log('Stato precedente caricato:', stateLoaded);
        
        // Recupera dati storici freschi
        const historicalLoaded = await fetchAndUpdateHistoricalData(CONFIG.symbol, CONFIG.interval);
        
        if (historicalLoaded) {
            console.log('✅ Dati storici caricati con successo');
            
            // Mostra info stato finale
            const stateInfo = getStateInfo(CONFIG.symbol.toLowerCase());
            console.log('Info stato finale:', stateInfo);
            
        } else {
            console.error('❌ Errore nel caricamento dati storici');
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.error('Errore nell\'inizializzazione:', error);
        return false;
    }
}

// ================= AVVIO APPLICAZIONE =================

async function startApplication() {
    try {
        console.log('🚀 Avvio applicazione trading...');
        
        // Carica dati storici
        const initialized = await loadHistoricalData();
        
        if (!initialized) {
            console.error('Inizializzazione fallita, impossibile continuare');
            return;
        }
        
        // Avvia WebSocket
        connectWebSocket();
        
        console.log('✅ Applicazione avviata con successo');
        
    } catch (error) {
        console.error('Errore critico nell\'avvio:', error);
    }
}

// ================= GESTIONE FINESTRA =================

window.addEventListener('beforeunload', function() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close();
    }
});

// ================= AVVIO AUTOMATICO =================

// Avvia quando DOM è pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApplication);
} else {
    startApplication();
}

// Export per debugging
window.tradingApp = {
    getConnectionStatus: () => connectionStatus,
    getStateInfo: () => getStateInfo(CONFIG.symbol.toLowerCase()),
    reconnect: connectWebSocket,
    loadHistorical: () => loadHistoricalData()
};