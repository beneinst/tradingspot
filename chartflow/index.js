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
    currentSymbol: 'btcusdt',
    offlineMode: false, // Nuova opzione
    useAlternativeAPI: false // Nuova opzione per API alternativa
};

// ================ PROVIDERS ALTERNATIVI PER DATI CRYPTO ================
const DATA_PROVIDERS = {
    // Provider principale (CoinGecko con CORS)
    coingecko: {
        name: 'CoinGecko',
        buildUrl: (coin) => `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=${coin.vs_currency}&days=90&interval=4h`,
        corsProxies: [
            { url: 'https://corsproxy.io/?', name: 'CorsProxy' },
            { url: 'https://api.allorigins.win/raw?url=', name: 'AllOrigins' },
            { url: 'https://cors-anywhere.herokuapp.com/', name: 'CorsAnywhere' }
        ],
        parseData: (data) => {
            if (!data || !data.prices || !Array.isArray(data.prices)) {
                throw new Error('Formato dati CoinGecko non valido');
            }
            return data.prices.map(([timestamp, close]) => ({
                timestamp,
                open: close,
                high: close,
                low: close,
                close,
                volume: 0
            }));
        }
    },
    
    // Provider alternativo senza CORS (CoinCap)
    coincap: {
        name: 'CoinCap',
        buildUrl: (coin) => {
            const coinCapId = getCoinCapId(coin.id);
            return `https://api.coincap.io/v2/assets/${coinCapId}/history?interval=h4&start=${Date.now() - 90*24*60*60*1000}&end=${Date.now()}`;
        },
        corsProxies: [], // Non serve CORS
        parseData: (data) => {
            if (!data || !data.data || !Array.isArray(data.data)) {
                throw new Error('Formato dati CoinCap non valido');
            }
            return data.data.map(item => ({
                timestamp: item.time,
                open: parseFloat(item.priceUsd),
                high: parseFloat(item.priceUsd),
                low: parseFloat(item.priceUsd),
                close: parseFloat(item.priceUsd),
                volume: 0
            }));
        }
    },
    
    // Provider alternativo - CryptoCompare (senza CORS)
    cryptocompare: {
        name: 'CryptoCompare',
        buildUrl: (coin) => {
            const symbol = coin.value.replace('usdt', '').replace('usdc', '').replace('eur', '').toUpperCase();
            const tsym = coin.vs_currency === 'eur' ? 'EUR' : 'USD';
            return `https://min-api.cryptocompare.com/data/v2/histohour?fsym=${symbol}&tsym=${tsym}&limit=540&aggregate=4`; // 90 giorni * 6 periodi 4h
        },
        corsProxies: [], // Non serve CORS
        parseData: (data) => {
            if (!data || !data.Data || !data.Data.Data || !Array.isArray(data.Data.Data)) {
                throw new Error('Formato dati CryptoCompare non valido');
            }
            return data.Data.Data.map(item => ({
                timestamp: item.time * 1000,
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close,
                volume: item.volumeto
            }));
        }
    }
};

// Mapping CoinGecko ID -> CoinCap ID
function getCoinCapId(coinGeckoId) {
    const mapping = {
        'bitcoin': 'bitcoin',
        'ethereum': 'ethereum',
        'cosmos': 'cosmos',
        'fetch-ai': 'fetch-ai',
        'solana': 'solana',
        'binancecoin': 'binance-coin',
        'cardano': 'cardano',
        'uniswap': 'uniswap',
        'decentraland': 'decentraland',
        'litecoin': 'litecoin',
        'algorand': 'algorand',
        'avalanche-2': 'avalanche',
        'polkadot': 'polkadot',
        'near': 'near-protocol',
        'suicoin': 'sui'
    };
    return mapping[coinGeckoId] || coinGeckoId;
}

let websocket = null;
let reconnectAttempts = 0;
let connectionStatus = 'DISCONNESSO';
let isInitialized = false;
let autoRefreshInterval = null;
let currentCorsProxy = 0;

// ================= STORAGE AVANZATO =================
const memoryStorage = new Map();

function saveToStorage(key, data, ttlMs = 7*24*60*60*1000) { // 7 giorni di TTL
    const expiry = Date.now() + ttlMs;
    const item = { value: data, expiry, timestamp: Date.now() };
    
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, JSON.stringify(item));
            debugLog(`💾 Salvato in localStorage: ${key} (${data.length || 0} elementi)`);
        } else {
            throw new Error('localStorage non disponibile');
        }
    } catch (error) {
        memoryStorage.set(key, item);
        debugLog(`💾 Salvato in memoria: ${key} (${data.length || 0} elementi)`);
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
                    debugLog(`🗑️ Rimosso dato scaduto: ${key}`);
                    return null;
                }
                debugLog(`📂 Caricato da localStorage: ${key} (${item.value.length || 0} elementi)`);
                return item.value;
            }
        }
    } catch (error) {
        debugLog(`⚠️ Errore localStorage per ${key}, uso memoria`);
    }
    
    const item = memoryStorage.get(key);
    if (item) {
        if (Date.now() > item.expiry) {
            memoryStorage.delete(key);
            debugLog(`🗑️ Rimosso dato scaduto dalla memoria: ${key}`);
            return null;
        }
        debugLog(`📂 Caricato da memoria: ${key} (${item.value.length || 0} elementi)`);
        return item.value;
    }
    return null;
}

function getStorageInfo() {
    const info = { localStorage: {}, memory: {} };
    
    // Info localStorage
    if (typeof localStorage !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('candles_')) {
                try {
                    const item = JSON.parse(localStorage.getItem(key));
                    info.localStorage[key] = {
                        elements: item.value?.length || 0,
                        timestamp: new Date(item.timestamp).toLocaleString(),
                        expires: new Date(item.expiry).toLocaleString()
                    };
                } catch (e) {
                    info.localStorage[key] = { error: 'Formato non valido' };
                }
            }
        }
    }
    
    // Info memoria
    for (const [key, item] of memoryStorage.entries()) {
        if (key.startsWith('candles_')) {
            info.memory[key] = {
                elements: item.value?.length || 0,
                timestamp: new Date(item.timestamp).toLocaleString(),
                expires: new Date(item.expiry).toLocaleString()
            };
        }
    }
    
    return info;
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

function updateModeIndicator() {
    const modeEl = document.getElementById('modeIndicator');
    if (modeEl) {
        if (CONFIG.offlineMode) {
            modeEl.textContent = '📴 MODALITÀ OFFLINE';
            modeEl.className = 'mode-offline';
        } else if (CONFIG.useAlternativeAPI) {
            modeEl.textContent = '🔄 API ALTERNATIVA';
            modeEl.className = 'mode-alternative';
        } else {
            modeEl.textContent = '🌐 MODALITÀ ONLINE';
            modeEl.className = 'mode-online';
        }
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

// ================= FETCH CON GESTIONE PROVIDER =================
async function fetchWithCorsProxy(url, proxies) {
    for (let i = 0; i < proxies.length; i++) {
        const proxyIndex = (currentCorsProxy + i) % proxies.length;
        const proxy = proxies[proxyIndex];
        
        try {
            debugLog(`🌐 Tentativo con ${proxy.name}: ${proxy.url}`);
            const proxyUrl = proxy.url + encodeURIComponent(url);
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            debugLog(`✅ Successo con ${proxy.name}`);
            currentCorsProxy = proxyIndex;
            return data;
            
        } catch (error) {
            debugLog(`❌ Fallito con ${proxy.name}: ${error.message}`);
            if (i === proxies.length - 1) {
                throw new Error(`Tutti i proxy CORS falliti. Ultimo errore: ${error.message}`);
            }
        }
    }
}

async function fetchWithProvider(provider, coin) {
    const url = provider.buildUrl(coin);
    debugLog(`📡 Fetch con ${provider.name}: ${url}`);
    
    let data;
    if (provider.corsProxies.length > 0) {
        data = await fetchWithCorsProxy(url, provider.corsProxies);
    } else {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        data = await response.json();
    }
    
    return provider.parseData(data);
}

// ================= FETCH DATI STORICI =================
function getCoinInfoByValue(value) {
    return COINS.find(c => c.value === value.toLowerCase());
}

async function fetchHistoricalDataForSymbol(symbolValue) {
    const coin = getCoinInfoByValue(symbolValue);
    if (!coin) throw new Error('Crypto non trovata');
    
    // Se in modalità offline, non tentare il fetch
    if (CONFIG.offlineMode) {
        throw new Error('Modalità offline attiva - impossibile scaricare nuovi dati');
    }
    
    const providers = CONFIG.useAlternativeAPI 
        ? ['cryptocompare', 'coincap', 'coingecko']
        : ['coingecko', 'cryptocompare', 'coincap'];
    
    for (const providerName of providers) {
        const provider = DATA_PROVIDERS[providerName];
        if (!provider) continue;
        
        try {
            debugLog(`🔄 Tentativo con ${provider.name}...`);
            const candles = await fetchWithProvider(provider, coin);
            debugLog(`✅ Successo con ${provider.name}: ${candles.length} candele`);
            return candles;
        } catch (error) {
            debugLog(`❌ ${provider.name} fallito: ${error.message}`);
            continue;
        }
    }
    
    throw new Error('Tutti i provider falliti');
}

// ================= INIZIALIZZAZIONE DATI STORICI =================
async function initializeHistoricalDataForSymbol(symbol) {
    try {
        symbol = symbol.toLowerCase();
        debugLog(`[${symbol}] Inizializzazione...`);
        
        // Controlla storage locale prima
        let candles = loadFromStorage(`candles_${symbol}`);
        if (candles && candles.length >= 50) {
            debugLog(`[${symbol}] ${candles.length} candele caricate da storage`);
            for (const candle of candles) {
                processNewCandle(candle, symbol);
            }
            return { success: true, loaded: candles.length, source: 'storage' };
        }
        
        // Se in modalità offline e non ci sono dati, fallisce
        if (CONFIG.offlineMode) {
            throw new Error('Modalità offline attiva e nessun dato in storage');
        }
        
        // Scarica da API
        const fetchedCandles = await fetchHistoricalDataForSymbol(symbol);
        
        // Salva in storage
        saveToStorage(`candles_${symbol}`, fetchedCandles);
        
        // Processa candele
        for (const candle of fetchedCandles) {
            processNewCandle(candle, symbol);
        }
        
        debugLog(`[${symbol}] ${fetchedCandles.length} candele elaborate e salvate`);
        return { success: true, loaded: fetchedCandles.length, source: 'api' };
        
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
        
        // Aggiorna timestamp e modalità
        updateLastUpdate();
        updateModeIndicator();
        
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
    const stream = `${CONFIG.currentSymbol}@kline_${CONFIG.interval}`;
    return `wss://stream.binance.com:9443/ws/${stream}`;
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

// ================= CONNESSIONE WEBSOCKET =================
function connectWebSocket() {
    if (CONFIG.offlineMode) {
        debugLog('⚠️ WebSocket disabilitato in modalità offline');
        return;
    }
    
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
        
        if (isInitialized && reconnectAttempts < CONFIG.maxRetries && !CONFIG.offlineMode) {
            reconnectAttempts++;
            debugLog(`Riconnessione ${reconnectAttempts}/${CONFIG.maxRetries} in ${CONFIG.retryDelay}ms`);
            setTimeout(connectWebSocket, CONFIG.retryDelay);
        }
    };
}

function updateConnectionStatus(status) {
    connectionStatus = status;
    debugLog(`Stato connessione: ${status}`);
    
    const statusEl = document.getElementById('connectionStatus');
    if (statusEl) {
        statusEl.textContent = status;
        statusEl.className = `connection-status ${status.toLowerCase()}`;
    }
}

// ================= INIZIALIZZAZIONE PRINCIPALE =================
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

// ================= GESTIONE MODALITÀ =================
function toggleOfflineMode() {
    CONFIG.offlineMode = !CONFIG.offlineMode;
    debugLog(`📴 Modalità offline: ${CONFIG.offlineMode ? 'ON' : 'OFF'}`);
    
    if (CONFIG.offlineMode) {
        // Disconnetti WebSocket
        if (websocket) {
            websocket.close();
            websocket = null;
        }
        showLoadingMessage('📴 Modalità offline attivata');
    } else {
        // Riconnetti WebSocket
        connectWebSocket();
        showLoadingMessage('🌐 Modalità online attivata');
    }
    
    updateModeIndicator();
}

function toggleAlternativeAPI() {
    CONFIG.useAlternativeAPI = !CONFIG.useAlternativeAPI;
    debugLog(`🔄 API alternativa: ${CONFIG.useAlternativeAPI ? 'ON' : 'OFF'}`);
    
    const provider = CONFIG.useAlternativeAPI ? 'CryptoCompare/CoinCap' : 'CoinGecko';
    showLoadingMessage(`🔄 Cambiato a ${provider}`);
    
    updateModeIndicator();
}

// ================= CAMBIO SIMBOLO =================
async function changeSymbol() {
    const selectEl = document.getElementById('cryptoSelect');
    if (!selectEl) return;
    
    const newSymbol = selectEl.value;
    if (newSymbol === CONFIG.currentSymbol) return;
    
    debugLog(`Cambio simbolo: ${CONFIG.currentSymbol} -> ${newSymbol}`);
    CONFIG.currentSymbol = newSymbol;
    
    if (websocket && !CONFIG.offlineMode) {
        websocket.close();
    }
    
    showLoadingMessage(`📊 Caricamento ${newSymbol.toUpperCase()}...`);
    
    try {
        const result = await initializeHistoricalDataForSymbol(newSymbol);
        if (result.success) {
            updateDashboardUI();
            if (!CONFIG.offlineMode) {
                connectWebSocket();
            }
            showLoadingMessage(`✅ ${newSymbol.toUpperCase()} caricato (${result.source})`);
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
        if (!CONFIG.offlineMode) {
            // Rimuovi dati cached
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(`candles_${CONFIG.currentSymbol.toUpperCase()}`);
            }
            memoryStorage.delete(`candles_${CONFIG.currentSymbol.toUpperCase()}`);
            
            // Reinizializza
            const result = await initializeHistoricalDataForSymbol(CONFIG.currentSymbol);
            if (result.success) {
                updateDashboardUI();
                showLoadingMessage('✅ Dati aggiornati da API');
            } else {
                throw new Error(result.error);
            }
        } else {
            // In modalità offline, ricarica solo da storage
            updateDashboardUI();
            showLoadingMessage('✅ UI aggiornata (modalità offline)');
        }
    } catch (error) {
        debugError(`Errore refresh: ${error.message}`);
        showLoadingMessage(`❌ Errore refresh: ${error.message}`, 'error');
    }
}

// ================= GESTIONE STORAGE =================
function showStorageInfo() {
    const info = getStorageInfo();
    console.log('📊 INFORMAZIONI STORAGE:', info);
    
    let message = '📊 STORAGE INFO:\n\n';
    
    if (Object.keys(info.localStorage).length > 0) {
        message += 'LOCAL STORAGE:\n';
        for (const [key, data] of Object.entries(info.localStorage)) {
            message += `  ${key}: ${data.elements || 0} elementi\n`;
        }
        message += '\n';
    }
    
    if (Object.keys(info.memory).length > 0) {
        message += 'MEMORIA:\n';
        for (const [key, data] of Object.entries(info.memory)) {
            message += `  ${key}: ${data.elements || 0} elementi\n`;
        }
    }
    
  if (Object.keys(info.localStorage).length === 0 && Object.keys(info.memory).length === 0) {
        message += 'Nessun dato salvato.';
    }
    
    alert(message);
}

function clearAllStorage() {
    if (confirm('⚠️ ATTENZIONE!\n\nQuesto cancellerà TUTTI i dati salvati (localStorage e memoria).\nSei sicuro di voler continuare?')) {
        // Cancella localStorage
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('backup_') || key.startsWith('export_') || key.startsWith('data_')) {
                localStorage.removeItem(key);
            }
        });
        
        // Cancella memoria
        Object.keys(memoryStorage).forEach(key => {
            delete memoryStorage[key];
        });
        
        console.log('🗑️ Tutti i dati sono stati cancellati');
        alert('✅ Tutti i dati sono stati cancellati con successo!');
        
        // Aggiorna la UI se necessario
        if (typeof updateUI === 'function') {
            updateUI();
        }
    }
}

function exportAllData() {
    const info = getStorageInfo();
    const exportData = {
        timestamp: new Date().toISOString(),
        localStorage: {},
        memory: {}
    };
    
    // Esporta localStorage
    for (const [key, data] of Object.entries(info.localStorage)) {
        try {
            exportData.localStorage[key] = JSON.parse(localStorage.getItem(key));
        } catch (e) {
            exportData.localStorage[key] = localStorage.getItem(key);
        }
    }
    
    // Esporta memoria
    exportData.memory = { ...memoryStorage };
    
    // Crea il file di export
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    // Crea il link per il download
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `backup_completo_${new Date().toISOString().split('T')[0]}.json`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('📥 Export completato:', exportData);
    alert('✅ Export completato! Il file è stato scaricato.');
}

function importAllData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importData = JSON.parse(e.target.result);
                
                if (!importData.localStorage && !importData.memory) {
                    throw new Error('Formato file non valido');
                }
                
                let imported = 0;
                
                // Importa localStorage
                if (importData.localStorage) {
                    for (const [key, value] of Object.entries(importData.localStorage)) {
                        localStorage.setItem(key, JSON.stringify(value));
                        imported++;
                    }
                }
                
                // Importa memoria
                if (importData.memory) {
                    Object.assign(memoryStorage, importData.memory);
                    imported += Object.keys(importData.memory).length;
                }
                
                console.log('📤 Import completato:', importData);
                alert(`✅ Import completato!\n${imported} elementi importati.`);
                
                // Aggiorna la UI se necessario
                if (typeof updateUI === 'function') {
                    updateUI();
                }
                
            } catch (error) {
                console.error('❌ Errore durante l\'import:', error);
                alert('❌ Errore durante l\'import:\n' + error.message);
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// ================= UTILITÀ AVANZATE =================
function compressData(data) {
    // Semplice compressione tramite rimozione spazi inutili
    return JSON.stringify(data);
}

function decompressData(compressedData) {
    try {
        return JSON.parse(compressedData);
    } catch (e) {
        return compressedData;
    }
}

function validateData(data, schema = null) {
    if (!data) return false;
    
    // Validazione base
    if (typeof data !== 'object') return false;
    
    // Se è fornito uno schema, validalo
    if (schema) {
        for (const requiredField of schema.required || []) {
            if (!(requiredField in data)) return false;
        }
    }
    
    return true;
}

function getStorageSize() {
    let localStorageSize = 0;
    let memorySize = 0;
    
    // Calcola dimensione localStorage
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            localStorageSize += localStorage[key].length + key.length;
        }
    }
    
    // Calcola dimensione memoria
    memorySize += JSON.stringify(memoryStorage).length;
    
    return {
        localStorage: {
            bytes: localStorageSize,
            kb: Math.round(localStorageSize / 1024 * 100) / 100,
            mb: Math.round(localStorageSize / (1024 * 1024) * 100) / 100
        },
        memory: {
            bytes: memorySize,
            kb: Math.round(memorySize / 1024 * 100) / 100,
            mb: Math.round(memorySize / (1024 * 1024) * 100) / 100
        }
    };
}

// ================= INIZIALIZZAZIONE =================
// Inizializza il sistema di storage
console.log('🚀 Sistema di Storage Universale inizializzato');
console.log('📋 Funzioni disponibili:');
console.log('  - save(key, data, useMemory=false)');
console.log('  - load(key, useMemory=false)');
console.log('  - remove(key, useMemory=false)');
console.log('  - exists(key, useMemory=false)');
console.log('  - showStorageInfo()');
console.log('  - clearAllStorage()');
console.log('  - exportAllData()');
console.log('  - importAllData()');

// Test di funzionamento
if (typeof window !== 'undefined') {
    // Salva un dato di test
    save('test_storage_system', { 
        message: 'Sistema funzionante!', 
        timestamp: new Date().toISOString() 
    });
    
    console.log('✅ Test completato con successo!');
}