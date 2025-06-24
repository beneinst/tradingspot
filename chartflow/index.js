// ================= CONFIGURAZIONE MULTI-SIMBOLO =================
import { processNewCandle, loadState, getStateInfo, resetState } from './logica.js';


// =================== CONFIGURAZIONE ===================
const COINS = [

	{ id: 'bitcoin', label: 'BTC/USDT', value: 'btcusdt', vs_currency: 'usd' },
    { id: 'cosmos', label: 'ATOM/USDT', value: 'atomusdt', vs_currency: 'usd' },
    
    { id: 'ethereum', label: 'ETH/USDT', value: 'ethusdt', vs_currency: 'usd' },
    { id: 'fetch-ai', label: 'FET/USDC', value: 'fetusdc', vs_currency: 'usd' },
    { id: 'solana', label: 'SOL/USDC', value: 'solusdc', vs_currency: 'usd' },
    { id: 'binancecoin', label: 'BNB/USDC', value: 'bnbusdc', vs_currency: 'usd' },
    { id: 'cardano', label: 'ADA/EUR', value: 'adaeur', vs_currency: 'eur' },
    { id: 'uniswap', label: 'UNI/USDC', value: 'uniusdc', vs_currency: 'usd' },
    { id: 'decentraland', label: 'MANA/USDT', value: 'manausdt', vs_currency: 'usd' },
    { id: 'litecoin', label: 'LTC/USDT', value: 'ltcusdt', vs_currency: 'usd' },
    { id: 'algorand', label: 'ALGO/USDT', value: 'algousdt', vs_currency: 'usd' },
    { id: 'avalanche-2', label: 'AVAX/USDT', value: 'avaxusdt', vs_currency: 'usd' },
    { id: 'avalanche-2', label: 'AVAX/USDC', value: 'avaxusdc', vs_currency: 'usd' },
    { id: 'polkadot', label: 'DOT/USDC', value: 'dotusdc', vs_currency: 'usd' },
    { id: 'near', label: 'NEAR/USDC', value: 'nearusdc', vs_currency: 'usd' },
    { id: 'suicoin', label: 'SUI/USDC', value: 'suiusdc', vs_currency: 'usd' }
];

const CONFIG = {
    interval: '4h',
    maxRetries: 3,
    retryDelay: 5000,
    historyLimit: 200,
    debugMode: true,
    currentSymbol: 'btcusdt' // default
};

// ================ CORS PROXIES ================
const CORS_PROXIES = [
    { url: 'https://api.allorigins.win/raw?url=', name: 'AllOrigins', headers: {} },
    { url: 'https://corsproxy.io/?', name: 'CorsProxy.io', headers: {} },
    { url: 'https://api.cors.sh/', name: 'CORS.SH', headers: { 'x-cors-api-key': 'temp_377b9736f23299227d1968c88d19f0e7' } }
];

let websocket = null;
let reconnectAttempts = 0;
let connectionStatus = 'DISCONNESSO';
let isInitialized = false;
let autoRefreshInterval = null;
let currentCorsProxy = 0;

// ================= STORAGE ALTERNATIVO (IN-MEMORY) =================
const memoryStorage = new Map();

function saveToStorage(key, data, ttlMs = 60*24*60*60*1000) {
    const expiry = Date.now() + ttlMs;
    try {
        // Prova localStorage prima
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, JSON.stringify({ value: data, expiry }));
            debugLog(`Salvato in localStorage: ${key}`);
        } else {
            throw new Error('localStorage non disponibile');
        }
    } catch (error) {
        // Fallback a memoria
        memoryStorage.set(key, { value: data, expiry });
        debugLog(`Salvato in memoria: ${key}`);
    }
}

function loadFromStorage(key) {
    try {
        // Prova localStorage prima
        if (typeof localStorage !== 'undefined') {
            const itemStr = localStorage.getItem(key);
            if (itemStr) {
                const item = JSON.parse(itemStr);
                if (Date.now() > item.expiry) {
                    localStorage.removeItem(key);
                    return null;
                }
                debugLog(`Caricato da localStorage: ${key}`);
                return item.value;
            }
        }
    } catch (error) {
        debugLog(`Errore localStorage per ${key}, uso memoria`);
    }
    
    // Fallback a memoria
    const item = memoryStorage.get(key);
    if (item) {
        if (Date.now() > item.expiry) {
            memoryStorage.delete(key);
            return null;
        }
        debugLog(`Caricato da memoria: ${key}`);
        return item.value;
    }
    return null;
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
    
    // Mostra errore nell'UI
    showLoadingMessage(`❌ ${message}`, 'error');
}

// ================= UI HELPERS =================
function showLoadingMessage(message, type = 'info') {
    const loadingEl = document.getElementById('loadingMessage');
    if (loadingEl) {
        loadingEl.style.display = 'block';
        loadingEl.textContent = message;
        loadingEl.style.color = type === 'error' ? '#f44336' : '#4caf50';
        
        if (type !== 'error') {
            setTimeout(() => {
                loadingEl.style.display = 'none';
            }, 3000);
        }
    }
}

function updateLastUpdate() {
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl) {
        lastUpdateEl.textContent = new Date().toLocaleTimeString();
    }
}

// ================ POPOLAMENTO SELECT DINAMICO ================
function populateCryptoSelect() {
    const select = document.getElementById('cryptoSelect');
    if (!select) return;
    select.innerHTML = '';
    COINS.forEach(coin => {
        const option = document.createElement('option');
        option.value = coin.value;
        option.textContent = coin.label;
        select.appendChild(option);
    });
    select.value = CONFIG.currentSymbol;
}
document.addEventListener('DOMContentLoaded', populateCryptoSelect);

// ================= FETCH CON PROXY MULTIPLI =================
async function fetchWithProxy(url, options = {}) {
    for (let i = 0; i < CORS_PROXIES.length; i++) {
        const proxyIndex = (currentCorsProxy + i) % CORS_PROXIES.length;
        const proxy = CORS_PROXIES[proxyIndex];
        
        try {
            debugLog(`Tentativo con ${proxy.name}: ${proxy.url}`);
            
            const proxyUrl = proxy.url + encodeURIComponent(url);
            const fetchOptions = {
                ...options,
                headers: {
                    ...options.headers,
                    ...proxy.headers
                }
            };
            
            const response = await fetch(proxyUrl, fetchOptions);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            debugLog(`✅ Successo con ${proxy.name}`);
            currentCorsProxy = proxyIndex; // Ricorda il proxy funzionante
            return data;
            
        } catch (error) {
            debugLog(`❌ Fallito con ${proxy.name}: ${error.message}`);
            if (i === CORS_PROXIES.length - 1) {
                throw new Error(`Tutti i proxy CORS falliti. Ultimo errore: ${error.message}`);
            }
        }
    }
}

// ================ FETCH DATI STORICI DA COINGECKO ================
function getCoinInfoByValue(value) {
    return COINS.find(c => c.value === value);
}
function buildCoinGeckoUrl(coin) {
    // CoinGecko: /coins/{id}/market_chart?vs_currency={vs_currency}&days=90&interval=4h
    return `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=${coin.vs_currency}&days=90&interval=4h`;
}
async function fetchHistoricalDataForSymbol(symbolValue) {
    const coin = getCoinInfoByValue(symbolValue);
    if (!coin) throw new Error('Crypto non trovata');
    const url = buildCoinGeckoUrl(coin);
    let retries = CONFIG.maxRetries;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            debugLog(`[${symbolValue}] Tentativo ${attempt}/${retries} - CoinGecko`);
            showLoadingMessage(`📊 Caricamento ${coin.label}... (${attempt}/${retries})`);
            const data = await fetchWithProxy(url);
            if (!data.prices || !Array.isArray(data.prices)) throw new Error('Formato dati non valido');
            debugLog(`✅ [${symbolValue}] Ricevuti ${data.prices.length} punti`);
            return data.prices;
        } catch (error) {
            debugError(`[${symbolValue}] Tentativo ${attempt} fallito: ${error.message}`);
            if (attempt === retries) throw new Error(`Impossibile recuperare dati per ${symbolValue}: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay * attempt));
        }
    }
}



// ================= INIZIALIZZAZIONE DATI STORICI PER SIMBOLO =================
async function initializeHistoricalDataForSymbol(symbol) {
    try {
        debugLog(`[${symbol}] Inizializzazione...`);
        let candles = loadFromStorage(`candles_${symbol}`);
        if (candles && candles.length >= 50) {
            debugLog(`[${symbol}] ${candles.length} candele caricate da storage`);
            for (const candle of candles) {
                processNewCandle(candle, symbol.toLowerCase());
            }
            return { success: true, loaded: candles.length, source: 'storage' };
        }
        // Qui ottieni rawData come array di [timestamp, close]
        const rawData = await fetchHistoricalDataForSymbol(symbol);
        let parsedCandles = rawData.map(([timestamp, close]) => ({
            timestamp,
            open: close,
            high: close,
            low: close,
            close,
            volume: 0
        }));
        saveToStorage(`candles_${symbol}`, parsedCandles);
        for (const candle of parsedCandles) {
            processNewCandle(candle, symbol.toLowerCase());
        }
        debugLog(`[${symbol}] ${parsedCandles.length} candele elaborate e salvate`);
        return { success: true, loaded: parsedCandles.length, source: 'api' };
    } catch (error) {
        debugError(`[${symbol}] Errore inizializzazione: ${error.message}`);
        return { success: false, error: error.message };
    }
}


// ================= PARSING CANDELE =================
// =====function parseHistoricalCandle(rawCandle, index) {
 // =====   try {
  // =====      if (!Array.isArray(rawCandle) || rawCandle.length < 6) {
  // =====          return { candle: null, error: `Formato non valido (index: ${index})` };
  // =====      }
        
  // =====      const [timestamp, open, high, low, close, volume] = rawCandle;
  // =====      const candle = {
   // =====         timestamp: parseInt(timestamp),
  // =====          open: parseFloat(open),
  // =====          high: parseFloat(high),
  // =====          low: parseFloat(low),
  // =====          close: parseFloat(close),
  // =====          volume: parseFloat(volume)
  // =====      };
        
        // Validazione
  // =====      if (Object.values(candle).some(val => isNaN(val))) {
  // =====          return { candle: null, error: 'Valori non numerici' };
  // =====      }
        
 // =====       return { candle, error: null };
 // =====   } catch (error) {
 // =====       return { candle: null, error: `Errore parsing: ${error.message}` };
 // =====   }
// =====}

// ================= AGGIORNAMENTO UI =================
function updateDashboardUI() {
    try {
        const stateInfo = getStateInfo(CONFIG.currentSymbol);
        if (!stateInfo) {
            debugLog('Nessun stato disponibile per aggiornare la UI');
            return;
        }
        
        debugLog('Aggiornamento UI con stato:', stateInfo);
        
        // Aggiorna segnale principale
        const mainSignalEl = document.getElementById('mainSignal');
        const signalStrengthEl = document.getElementById('signalStrength');
        
        if (mainSignalEl && signalStrengthEl) {
            const signal = stateInfo.signal || 'NEUTRO';
            const strength = stateInfo.confluenceScore || 0;
            
            mainSignalEl.className = `signal-status signal-${signal.toLowerCase()}`;
            mainSignalEl.querySelector('span').textContent = signal;
            signalStrengthEl.textContent = strength.toFixed(2);
        }
        
        // Aggiorna confluence score
        const confluenceScoreEl = document.getElementById('confluenceScore');
        if (confluenceScoreEl) {
            const score = stateInfo.confluenceScore || 0;
            confluenceScoreEl.textContent = score.toFixed(2);
            
            let scoreClass = 'score-neutral';
            if (score > 0.5) scoreClass = 'score-positive';
            else if (score < -0.5) scoreClass = 'score-negative';
            
            confluenceScoreEl.className = `confluence-score ${scoreClass}`;
        }
        
        // Aggiorna indicatori principali
        updateIndicatorValues(stateInfo);
        
        // Aggiorna timestamp
        updateLastUpdate();
        
        debugLog('✅ UI aggiornata con successo');
        
    } catch (error) {
        debugError('Errore aggiornamento UI:', error);
    }
}

function updateIndicatorValues(stateInfo) {
    const indicators = {
        'linregValue': stateInfo.linregPosition || 0,
        'pearsonValue': stateInfo.pearsonR || 0,
        'bbValue': stateInfo.bbPosition || 0,
        'stochValue': stateInfo.stochK || 0
    };
    
    for (const [id, value] of Object.entries(indicators)) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = typeof value === 'number' ? value.toFixed(2) : value;
        }
    }
}

// ================= WEBSOCKET =================
function buildCombinedStreamUrl() {
    // Per ora usa solo il simbolo corrente per semplificare
    const stream = `${CONFIG.currentSymbol}@kline_${CONFIG.interval}`;
    return `${CONFIG.wsUrl}${stream}`;
}

function parseWebSocketMessage(data) {
    try {
        const jsonData = JSON.parse(data);
        if (!jsonData.stream || !jsonData.data) return null;
        
        const symbol = jsonData.stream.split('@')[0];
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
        debugError('Errore parsing WebSocket:', error);
        return null;
    }
}

function handleWebSocketMessage(event) {
    const parsed = parseWebSocketMessage(event.data);
    if (!parsed) return;
    
    const { symbol, candle } = parsed;
    debugLog(`[WS] ${symbol}: ${candle.close} (closed: ${candle.closed})`);
    
    // Processa sempre la candela
    processNewCandle(candle, symbol);
    
    // Se è il simbolo corrente, aggiorna UI
    if (symbol === CONFIG.currentSymbol) {
        updateDashboardUI();
    }
    
    // Se candela chiusa, salva in storage
    if (candle.closed) {
        let candles = loadFromStorage(`candles_${symbol.toUpperCase()}`) || [];
        candles.push(candle);
        if (candles.length > CONFIG.historyLimit) {
            candles = candles.slice(-CONFIG.historyLimit);
        }
        saveToStorage(`candles_${symbol.toUpperCase()}`, candles);
    }
}

// ================= CONNESSIONE WEBSOCKET =================
function connectWebSocket() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close();
    }
    
    const wsUrl = buildCombinedStreamUrl();
    debugLog(`Connessione WebSocket: ${wsUrl}`);
    websocket = new WebSocket(wsUrl);

    websocket.onopen = function() {
        debugLog('✅ WebSocket connesso');
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
        
        if (isInitialized && reconnectAttempts < CONFIG.maxRetries) {
            reconnectAttempts++;
            debugLog(`Riconnessione ${reconnectAttempts}/${CONFIG.maxRetries} in ${CONFIG.retryDelay}ms`);
            setTimeout(connectWebSocket, CONFIG.retryDelay);
        }
    };
}

function updateConnectionStatus(status) {
    connectionStatus = status;
    debugLog(`Stato connessione: ${status}`);
}

// ================= INIZIALIZZAZIONE PRINCIPALE =================
async function initializeApplication() {
    try {
        debugLog('🚀 AVVIO INIZIALIZZAZIONE');
        showLoadingMessage('🚀 Inizializzazione sistema...');
        
        // Inizializza solo il simbolo corrente per ora
        const result = await initializeHistoricalDataForSymbol(CONFIG.currentSymbol.toUpperCase());
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        debugLog(`✅ ${CONFIG.currentSymbol} inizializzato: ${result.loaded} candele da ${result.source}`);
        
        // Aggiorna UI iniziale
        updateDashboardUI();
        
        isInitialized = true;
        showLoadingMessage('✅ Sistema inizializzato correttamente');
        
        return true;
        
    } catch (error) {
        debugError('❌ Errore inizializzazione:', error);
        showLoadingMessage(`❌ Errore: ${error.message}`, 'error');
        isInitialized = false;
        return false;
    }
}

// ================= CAMBIO SIMBOLO =================
async function changeSymbol() {
    const selectEl = document.getElementById('cryptoSelect');
    if (!selectEl) return;
    
    const newSymbol = selectEl.value;
    if (newSymbol === CONFIG.currentSymbol) return;
    
    debugLog(`Cambio simbolo: ${CONFIG.currentSymbol} -> ${newSymbol}`);
    CONFIG.currentSymbol = newSymbol;
    
    // Disconnetti WebSocket corrente
    if (websocket) websocket.close();
    
    // Inizializza nuovo simbolo
    showLoadingMessage(`📊 Caricamento ${newSymbol.toUpperCase()}...`);
    
    try {
        const result = await initializeHistoricalDataForSymbol(newSymbol.toUpperCase());
        if (result.success) {
            updateDashboardUI();
            connectWebSocket(); // Riconnetti con nuovo simbolo
            showLoadingMessage(`✅ ${newSymbol.toUpperCase()} caricato`);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        debugError(`Errore cambio simbolo: ${error.message}`);
        showLoadingMessage(`❌ Errore caricamento ${newSymbol}`, 'error');
    }
}

// ================= REFRESH MANUALE =================
async function refreshData() {
    debugLog('🔄 Refresh manuale richiesto');
    showLoadingMessage('🔄 Aggiornamento dati...');
    
    try {
        // Rimuovi dati cached
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(`candles_${CONFIG.currentSymbol.toUpperCase()}`);
        }
        memoryStorage.delete(`candles_${CONFIG.currentSymbol.toUpperCase()}`);
        
        // Reinizializza
        const result = await initializeHistoricalDataForSymbol(CONFIG.currentSymbol.toUpperCase());
        if (result.success) {
            updateDashboardUI();
            showLoadingMessage('✅ Dati aggiornati');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        debugError(`Errore refresh: ${error.message}`);
        showLoadingMessage(`❌ Errore refresh: ${error.message}`, 'error');
    }
}

// ================= AUTO REFRESH =================
function toggleAutoRefresh() {
    const btn = document.getElementById('autoRefreshBtn');
    if (!btn) return;
    
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        btn.textContent = '⏰ Auto Refresh: OFF';
        debugLog('Auto refresh disattivato');
    } else {
        autoRefreshInterval = setInterval(() => {
            debugLog('Auto refresh...');
            updateDashboardUI();
        }, 30000); // 30 secondi
        btn.textContent = '⏰ Auto Refresh: ON';
        debugLog('Auto refresh attivato (30s)');
    }
}

// ================= AVVIO APPLICAZIONE =================
async function startApplication() {
    try {
        debugLog('🎯 AVVIO APPLICAZIONE TRADING', {
            currentSymbol: CONFIG.currentSymbol,
            interval: CONFIG.interval,
            timestamp: new Date().toISOString()
        });
        
        const initialized = await initializeApplication();
        if (!initialized) {
            debugError('❌ Inizializzazione fallita');
            return;
        }
        
        // Avvia WebSocket
        connectWebSocket();
        
        debugLog('✅ APPLICAZIONE AVVIATA CON SUCCESSO');
        
    } catch (error) {
        debugError('❌ ERRORE CRITICO NELL\'AVVIO', error);
    }
}

// ================= ESPOSIZIONE FUNZIONI GLOBALI =================
window.changeSymbol = changeSymbol;
window.refreshData = refreshData;
window.toggleAutoRefresh = toggleAutoRefresh;

// ================= GESTIONE EVENTI =================
window.addEventListener('beforeunload', function() {
    if (websocket) websocket.close();
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
});

document.addEventListener('visibilitychange', function() {
    if (!document.hidden && isInitialized && (!websocket || websocket.readyState !== WebSocket.OPEN)) {
        debugLog('Riconnessione dopo visibilità...');
        setTimeout(connectWebSocket, 1000);
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
    getCurrentSymbol: () => CONFIG.currentSymbol,
    getStateInfo: () => getStateInfo(CONFIG.currentSymbol),
    refreshData,
    changeSymbol,
    reconnect: () => {
        reconnectAttempts = 0;
        connectWebSocket();
    },
    restart: startApplication,
    enableDebug: () => { CONFIG.debugMode = true; },
    disableDebug: () => { CONFIG.debugMode = false; }
};