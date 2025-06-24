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

let websocket = null;
let reconnectAttempts = 0;
let connectionStatus = 'DISCONNESSO';
let isInitialized = false;
let autoRefreshInterval = null;

// ================= STORAGE (LOCALSTORAGE + FALLBACK IN-MEMORY) =================
const memoryStorage = new Map();

function saveToStorage(key, data, ttlMs = 60*24*60*60*1000) {
    const expiry = Date.now() + ttlMs;
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, JSON.stringify({ value: data, expiry }));
            debugLog(`Salvato in localStorage: ${key}`);
        } else {
            throw new Error('localStorage non disponibile');
        }
    } catch (error) {
        memoryStorage.set(key, { value: data, expiry });
        debugLog(`Salvato in memoria: ${key}`);
    }
}

function loadFromStorage(key) {
    try {
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

// ================= POPOLAMENTO SELECT =================
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

// ================= INIZIALIZZAZIONE DATI STORICI (SOLO OFFLINE) =================
async function initializeHistoricalDataForSymbol(symbol) {
    try {
        symbol = symbol.toLowerCase();
        debugLog(`[${symbol}] Inizializzazione offline...`);
        let candles = loadFromStorage(`candles_${symbol}`);
        if (candles && candles.length >= 50) {
            debugLog(`[${symbol}] ${candles.length} candele caricate da storage`);
            for (const candle of candles) {
                processNewCandle(candle, symbol);
            }
            return { success: true, loaded: candles.length, source: 'storage' };
        } else {
            showLoadingMessage('⚠️ Nessun dato disponibile offline. Carica manualmente i dati.', 'warning');
            return { success: false, error: 'No offline data available', source: 'storage' };
        }
    } catch (error) {
        debugError(`[${symbol}] Errore inizializzazione: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// ================= AGGIORNAMENTO UI =================
function updateDashboardUI() {
    try {
        const stateInfo = getStateInfo(CONFIG.currentSymbol);
        if (!stateInfo) {
            debugLog('Nessun stato disponibile per aggiornare la UI');
            return;
        }
        debugLog('Aggiornamento UI con stato:', stateInfo);
        const mainSignalEl = document.getElementById('mainSignal');
        const signalStrengthEl = document.getElementById('signalStrength');
        if (mainSignalEl && signalStrengthEl) {
            const signal = stateInfo.signal || 'NEUTRO';
            const strength = stateInfo.confluenceScore || 0;
            mainSignalEl.className = `signal-status signal-${signal.toLowerCase()}`;
            mainSignalEl.querySelector('span').textContent = signal;
            signalStrengthEl.textContent = strength.toFixed(2);
        }
        const confluenceScoreEl = document.getElementById('confluenceScore');
        if (confluenceScoreEl) {
            const score = stateInfo.confluenceScore || 0;
            confluenceScoreEl.textContent = score.toFixed(2);
            let scoreClass = 'score-neutral';
            if (score > 0.5) scoreClass = 'score-positive';
            else if (score < -0.5) scoreClass = 'score-negative';
            confluenceScoreEl.className = `confluence-score ${scoreClass}`;
        }
        updateIndicatorValues(stateInfo);
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

// ================= WEBSOCKET (OPZIONALE, SOLO SE USI SERVER LOCALE) =================
// Se non usi WebSocket, puoi commentare/eliminare tutto questo blocco
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
    processNewCandle(candle, symbol);
    if (symbol === CONFIG.currentSymbol) {
        updateDashboardUI();
    }
    if (candle.closed) {
        let candles = loadFromStorage(`candles_${symbol.toUpperCase()}`) || [];
        candles.push(candle);
        if (candles.length > CONFIG.historyLimit) {
            candles = candles.slice(-CONFIG.historyLimit);
        }
        saveToStorage(`candles_${symbol.toUpperCase()}`, candles);
    }
}

function connectWebSocket() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close();
    }
    // Nota: solo se usi un server WebSocket locale, altrimenti commenta/elimina
    const wsUrl = buildCombinedStreamUrl(); // Assicurati che questa funzione esista solo se serve
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
        update2ConnectionStatus('ERRORE');
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

// ================= INIZIALIZZAZIONE PRINCIPALE (SOLO OFFLINE) =================
async function initializeApplication() {
    try {
        debugLog('🚀 AVVIO INIZIALIZZAZIONE');
        showLoadingMessage('🚀 Inizializzazione sistema...');
        const result = await initializeHistoricalDataForSymbol(CONFIG.currentSymbol);
        if (!result.success) {
            throw new Error(result.error);
        }
        debugLog(`✅ ${CONFIG.currentSymbol} inizializzato: ${result.loaded} candele da ${result.source}`);
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

// ================= CAMBIO SIMBOLO (SOLO OFFLINE) =================
async function changeSymbol() {
    const selectEl = document.getElementById('cryptoSelect');
    if (!selectEl) return;
    const newSymbol = selectEl.value;
    if (newSymbol === CONFIG.currentSymbol) return;
    debugLog(`Cambio simbolo: ${CONFIG.currentSymbol} -> ${newSymbol}`);
    CONFIG.currentSymbol = newSymbol;
    if (websocket) websocket.close();
    showLoadingMessage(`📊 Caricamento ${newSymbol.toUpperCase()}...`);
    try {
        const result = await initializeHistoricalDataForSymbol(newSymbol);
        if (result.success) {
            updateDashboardUI();
            showLoadingMessage(`✅ ${newSymbol.toUpperCase()} caricato`);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        debugError(`Errore cambio simbolo: ${error.message}`);
        showLoadingMessage(`❌ Errore caricamento ${newSymbol}`, 'error');
    }
}

// ================= REFRESH MANUALE (SOLO OFFLINE) =================
async function refreshData() {
    debugLog('🔄 Refresh manuale richiesto');
    showLoadingMessage('🔄 Aggiornamento dati...');
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(`candles_${CONFIG.currentSymbol.toUpperCase()}`);
        }
        memoryStorage.delete(`candles_${CONFIG.currentSymbol.toUpperCase()}`);
        const result = await initializeHistoricalDataForSymbol(CONFIG.currentSymbol);
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

// ================= AUTO REFRESH (SOLO UI, NON DATI) =================
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

// ================= AVVIO AUTOMATICO =================
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
        // Se usi WebSocket locale, decommenta questa riga
        // connectWebSocket();
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

// ================= CARICAMENTO DATI DA FILE JSON (OPZIONALE) =================
function loadDataFromJsonFile(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            callback(null, data);
        } catch (error) {
            callback(error, null);
        }
    };
    reader.onerror = function(error) {
        callback(error, null);
    };
    reader.readAsText(file);
}

};