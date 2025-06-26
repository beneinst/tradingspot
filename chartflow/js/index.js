// =================== CONFIGURAZIONE MULTI-SIMBOLO ===================
import { processNewCandle, getCurrentState, resetState } from './logica.js';

const COINS = [
    { id: 'bitcoin', label: 'BTC/USDT', value: 'btcusdt', vs_currency: 'usd', dataUrl: 'https://tuosito.com/data/btcusdt_4h.json' },
    { id: 'cosmos', label: 'ATOM/USDT', value: 'atomusdt', vs_currency: 'usd', dataUrl: 'https://tuosito.com/data/atomusdt_4h.json' },
    { id: 'ethereum', label: 'ETH/USDT', value: 'ethusdt', vs_currency: 'usd', dataUrl: 'https://tuosito.com/data/ethusdt_4h.json' },
    { id: 'fetch-ai', label: 'FET/USDC', value: 'fetusdc', vs_currency: 'usd', dataUrl: 'https://tuosito.com/data/fetusdc_4h.json' },
    { id: 'solana', label: 'SOL/USDC', value: 'solusdc', vs_currency: 'usd', dataUrl: 'https://tuosito.com/data/solusdc_4h.json' },
    { id: 'binancecoin', label: 'BNB/USDC', value: 'bnbusdc', vs_currency: 'usd', dataUrl: 'https://tuosito.com/data/bnbusdc_4h.json' },
    { id: 'cardano', label: 'ADA/EUR', value: 'adaeur', vs_currency: 'eur', dataUrl: 'https://tuosito.com/data/adaeur_4h.json' },
    { id: 'uniswap', label: 'UNI/USDC', value: 'uniusdc', vs_currency: 'usd', dataUrl: 'https://tuosito.com/data/uniusdc_4h.json' },
    { id: 'decentraland', label: 'MANA/USDT', value: 'manausdt', vs_currency: 'usd', dataUrl: 'https://tuosito.com/data/manausdt_4h.json' },
    { id: 'litecoin', label: 'LTC/USDT', value: 'ltcusdt', vs_currency: 'usd', dataUrl: 'https://tuosito.com/data/ltcusdt_4h.json' },
    { id: 'algorand', label: 'ALGO/USDT', value: 'algousdt', vs_currency: 'usd', dataUrl: 'https://tuosito.com/data/algousdt_4h.json' },
    { id: 'avalanche-2', label: 'AVAX/USDT', value: 'avaxusdt', vs_currency: 'usd', dataUrl: 'https://tuosito.com/data/avaxusdt_4h.json' },
    { id: 'avalanche-2', label: 'AVAX/USDC', value: 'avaxusdc', vs_currency: 'usd', dataUrl: 'https://tuosito.com/data/avaxusdc_4h.json' },
    { id: 'polkadot', label: 'DOT/USDC', value: 'dotusdc', vs_currency: 'usd', dataUrl: 'https://tuosito.com/data/dotusdc_4h.json' },
    { id: 'near', label: 'NEAR/USDC', value: 'nearusdc', vs_currency: 'usd', dataUrl: 'https://tuosito.com/data/nearusdc_4h.json' },
    { id: 'suicoin', label: 'SUI/USDC', value: 'suiusdc', vs_currency: 'usd', dataUrl: 'https://tuosito.com/data/suiusdc_4h.json' }
];

const CONFIG = {
    currentSymbol: 'btcusdt', // minuscolo per coerenza
    interval: '4h',
    maxRetries: 3,
    retryDelay: 5000,
    historyLimit: 200,
    debugMode: true
};

let downloadedData = null;

// =================== FUNZIONI UTILITY ===================

function getCurrentCoin() {
    return COINS.find(coin => coin.value.toLowerCase() === CONFIG.currentSymbol.toLowerCase());
}

function showLoadingMessage(message) {
    let loadingDiv = document.getElementById('loadingMessage');
    if (!loadingDiv) {
        loadingDiv = document.createElement('div');
        loadingDiv.id = 'loadingMessage';
        loadingDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #232a34;
            color: #ffc200;
            padding: 12px 28px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.18);
            z-index: 9999;
        `;
        document.body.appendChild(loadingDiv);
    }
    loadingDiv.textContent = message || 'Caricamento...';
    loadingDiv.style.display = 'block';
}

function hideLoadingMessage() {
    const loadingDiv = document.getElementById('loadingMessage');
    if (loadingDiv) loadingDiv.style.display = 'none';
}

function showStatusMessage(message, type = 'info') {
    let statusDiv = document.getElementById('statusMessage');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'statusMessage';
        const colors = {
            error: { bg: '#ff4d4d', color: '#fff' },
            success: { bg: '#26ff8a', color: '#222831' },
            info: { bg: '#232a34', color: '#ffc200' }
        };
        const colorScheme = colors[type] || colors.info;
        statusDiv.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${colorScheme.bg};
            color: ${colorScheme.color};
            padding: 12px 28px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.18);
            z-index: 9999;
        `;
        document.body.appendChild(statusDiv);
    }
    statusDiv.textContent = message || '';
    statusDiv.style.display = 'block';
    clearTimeout(statusDiv._timeout);
    statusDiv._timeout = setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 4000);
}

function debugLog(message, data = null) {
    const timestamp = new Date().toISOString();
    if (data) {
        console.log(`[${timestamp}] ${message}`, data);
    } else {
        console.log(`[${timestamp}] ${message}`);
    }
    const debugDiv = document.getElementById('debugInfo');
    if (debugDiv) {
        debugDiv.style.display = 'block';
        const msg = data ? `${message}: ${JSON.stringify(data, null, 2)}` : message;
        debugDiv.innerHTML += `<div>${new Date().toTimeString().split(' ')[0]} - ${msg}</div>`;
        debugDiv.scrollTop = debugDiv.scrollHeight;
    }
}

function debugError(message, error = null) {
    debugLog(`❌ ERROR: ${message}`, error);
    console.error(`❌ ERROR: ${message}`, error);
}

// =================== POPOLAMENTO SELECT ===================

function populateCryptoSelect() {
    console.log('🔄 populateCryptoSelect chiamata');
    const select = document.getElementById('cryptoSelect');
    if (!select) {
        console.error('❌ Elemento cryptoSelect non trovato nel DOM');
        debugError('Elemento cryptoSelect non trovato nel DOM');
        return false;
    }
    try {
        select.innerHTML = '<option value="" disabled selected>Seleziona una criptovaluta...</option>';
        COINS.forEach((coin, index) => {
            const option = document.createElement('option');
            option.value = coin.value;
            option.textContent = coin.label;
            select.appendChild(option);
            console.log(`➕ Aggiunta opzione ${index + 1}: ${coin.label} (${coin.value})`);
        });
        select.value = CONFIG.currentSymbol;
        console.log(`✅ Select popolata con ${COINS.length} elementi, valore corrente: ${CONFIG.currentSymbol}`);
        return true;
    } catch (error) {
        console.error('❌ Errore nel popolamento della select:', error);
        debugError('Errore nel popolamento della select', error);
        return false;
    }
}

// =================== AGGIORNAMENTO DASHBOARD ===================

function refreshData() {
    console.log('🔄 refreshData chiamata');
    try {
        const state = getCurrentState();
        debugLog('refreshData - getCurrentState:', state);
        if (!state) {
            console.warn('⚠️ Nessuno stato disponibile');
            return;
        }
        const indicators = state.indicators || {};
        const mainSignal = state.signal || "NONE";
        const timerCount = state.timerCount || 0;
        const timerMax = 12; // fisso, come in logica.js

        // Mappa elementi da aggiornare
        const elementsToUpdate = {
            'mainSignal': mainSignal,
            'timerStatus': mainSignal !== "NONE" ? "ATTIVO" : "NESSUN OK",
            'timerProgress': mainSignal !== "NONE" ? `${timerCount}/${timerMax}` : `0/${timerMax}`,
            'currentPrice': indicators.currentPrice?.toFixed(2) || "0.00",
            'ema': indicators.ema?.toFixed(2) || "0.00",
            'sma': indicators.sma?.toFixed(2) || "0.00",
            'rsi': indicators.rsi?.toFixed(2) || "50.00",
            'candles': indicators.candles?.toString() || "0",
            'bbPosition': indicators.bb?.position?.toFixed(4) || "0.0000",
            'bbUpper': indicators.bb?.upper?.toFixed(2) || "0.00",
            'bbLower': indicators.bb?.lower?.toFixed(2) || "0.00",
            'bbBasis': indicators.bb?.basis?.toFixed(2) || "0.00",
            'linreg': indicators.linreg?.toFixed(6) || "0.000000",
            'macdStatus': indicators.macd?.histogram > 0 ? "BULLISH" : indicators.macd?.histogram < 0 ? "BEARISH" : "NEUTRO",
            'trendStatus': indicators.ema && indicators.sma ? (indicators.ema > indicators.sma ? "BULLISH" : "BEARISH") : "NEUTRO",
            'barsElapsed': mainSignal !== "NONE" ? timerCount.toString() : "--",
            'barsRemaining': mainSignal !== "NONE" ? (timerMax - timerCount).toString() : "--",
            'lastSignalType': mainSignal !== "NONE" ? mainSignal : "--",
            'signalStrength': mainSignal !== "NONE" ? "ATTIVO" : "NESSUNO"
        };

        // Aggiorna elementi HTML
        let updatedCount = 0;
        let notFoundCount = 0;
        for (const [elementId, value] of Object.entries(elementsToUpdate)) {
            const el = document.getElementById(elementId);
            if (el) {
                el.textContent = value;
                updatedCount++;
                if (CONFIG.debugMode) console.log(`✅ ${elementId}: ${value}`);
            } else {
                notFoundCount++;
                if (CONFIG.debugMode) console.warn(`❌ Elemento non trovato: ${elementId}`);
            }
        }

        // Aggiorna colori segnale e timer
        updateSignalColors(mainSignal);
        updateTimerColors(timerCount, timerMax);

        console.log(`📈 Dashboard aggiornata: ${updatedCount} elementi aggiornati, ${notFoundCount} non trovati`);
    } catch (error) {
        console.error('❌ Errore in refreshData:', error);
        debugError('Errore in refreshData', error);
    }
}

function updateSignalColors(signal) {
    const signalEl = document.getElementById('mainSignal');
    if (signalEl) {
        signalEl.className = `signal-${signal.toLowerCase()}`;
        switch(signal) {
            case 'BUY': signalEl.style.color = '#26ff8a'; break;
            case 'SELL': signalEl.style.color = '#ff4d4d'; break;
            default: signalEl.style.color = '#ffc200';
        }
    }
}

function updateTimerColors(current, max) {
    const timerEl = document.getElementById('timerProgress');
    if (timerEl) {
        const percentage = (current / max) * 100;
        if (percentage > 80) timerEl.style.color = '#ff4d4d';
        else if (percentage > 50) timerEl.style.color = '#ffc200';
        else timerEl.style.color = '#26ff8a';
    }
}

// =================== CAMBIO SIMBOLO ===================

function changeSymbol() {
    const selectEl = document.getElementById('cryptoSelect');
    if (!selectEl) {
        debugError('Elemento cryptoSelect non trovato per cambio simbolo');
        return;
    }
    const newSymbol = selectEl.value;
    if (!newSymbol) {
        console.warn('⚠️ Nessun simbolo selezionato');
        return;
    }
    if (newSymbol === CONFIG.currentSymbol) {
        console.log('ℹ️ Simbolo già selezionato:', newSymbol);
        return;
    }
    debugLog(`🔄 Cambio simbolo: ${CONFIG.currentSymbol} -> ${newSymbol}`);
    CONFIG.currentSymbol = newSymbol;
    resetState();
    refreshData();
    updateDownloadButton();
    showStatusMessage(`📊 Selezionato ${newSymbol.toUpperCase()}`, 'success');
}

// =================== DOWNLOAD E UPLOAD ===================

function updateDownloadButton() {
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadLinkField = document.getElementById('downloadLink');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const currentCoin = getCurrentCoin();

    if (currentCoin && downloadBtn) {
        const symbol = currentCoin.value.toUpperCase();
        const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=4h&limit=500`;
        downloadBtn.disabled = false;
        downloadBtn.textContent = `📥 Scarica ${currentCoin.label}`;
        downloadBtn.title = `Scarica dati da Binance: ${binanceUrl}`;
        downloadBtn.onclick = () => {
            window.open(binanceUrl, '_blank');
            showStatusMessage(`Link di ${currentCoin.label} aperto in una nuova finestra`, 'success');
        };
        if (downloadLinkField) {
            downloadLinkField.value = binanceUrl;
            downloadLinkField.style.display = 'block';
        }
        if (copyLinkBtn) {
            copyLinkBtn.style.display = 'block';
        }
    } else if (downloadBtn) {
        downloadBtn.disabled = true;
        downloadBtn.textContent = '📥 Link non disponibile';
        downloadBtn.title = 'Nessun link configurato per questa criptovaluta';
        if (downloadLinkField) downloadLinkField.style.display = 'none';
        if (copyLinkBtn) copyLinkBtn.style.display = 'none';
    }
}

function setupCopyLinkButton() {
    const copyBtn = document.getElementById('copyLinkBtn');
    const linkField = document.getElementById('downloadLink');
    if (!copyBtn || !linkField) return;
    copyBtn.onclick = async () => {
        try {
            await navigator.clipboard.writeText(linkField.value);
            showStatusMessage('Link copiato negli appunti!', 'success');
        } catch (err) {
            debugError('Errore copia link:', err);
            showStatusMessage('Errore durante la copia del link', 'error');
        }
    };
}

function parseKlineData(rawData) {
    if (!Array.isArray(rawData) || rawData.length === 0) {
        throw new Error('Dati non validi: deve essere un array non vuoto');
    }
    const firstItem = rawData[0];
    let candles = [];
    if (Array.isArray(firstItem) && firstItem.length >= 6) {
        // Formato Binance (array di array)
        console.log('📊 Riconosciuto formato Binance (array di array)');
        candles = rawData.map(k => ({
            timestamp: parseInt(k[0]),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            closed: true
        }));
    } else if (typeof firstItem === 'object') {
        // Formato oggetti
        console.log('📊 Riconosciuto formato oggetti');
        candles = rawData.map(k => ({
            timestamp: k.timestamp || k.time || k.date,
            open: parseFloat(k.open || k.o),
            high: parseFloat(k.high || k.h),
            low: parseFloat(k.low || k.l),
            close: parseFloat(k.close || k.c),
            volume: parseFloat(k.volume || k.v || 0),
            closed: k.closed !== false
        }));
    } else {
        throw new Error('Formato dati non riconosciuto');
    }
    // Filtra e ordina
    candles = candles.filter(candle =>
        candle.timestamp &&
        !isNaN(candle.open) &&
        !isNaN(candle.high) &&
        !isNaN(candle.low) &&
        !isNaN(candle.close) &&
        candle.high >= candle.low &&
        candle.high >= Math.max(candle.open, candle.close) &&
        candle.low <= Math.min(candle.open, candle.close)
    );
    candles.sort((a, b) => a.timestamp - b.timestamp);
    return candles;
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        debugLog('Nessun file selezionato');
        return;
    }
    console.log(`📁 File selezionato: ${file.name} (${file.size} bytes)`);
    if (!CONFIG.currentSymbol) {
        showStatusMessage('Seleziona prima una criptovaluta!', 'error');
        return;
    }
    showLoadingMessage('Caricando e processando file...');
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            debugLog('📊 Parsing JSON file...');
            const rawData = JSON.parse(e.target.result);
            console.log(`✅ JSON parsato: ${rawData.length} elementi`);
            const candles = parseKlineData(rawData);
            if (!candles || candles.length === 0) {
                throw new Error('Nessuna candela valida trovata nei dati');
            }
            console.log(`📈 Processate ${candles.length} candele valide`);
            downloadedData = candles;
            hideLoadingMessage();
            showStatusMessage(`✅ File caricato con successo! ${candles.length} candele`, 'success');
            processDownloadedData();
        } catch (error) {
            debugError('Errore processamento file:', error);
            hideLoadingMessage();
            showStatusMessage(`❌ Errore nel processamento del file: ${error.message}`, 'error');
        }
    };
    reader.onerror = function() {
        debugError('Errore lettura file');
        hideLoadingMessage();
        showStatusMessage('❌ Errore nella lettura del file', 'error');
    };
    reader.readAsText(file);
}

function processDownloadedData() {
    if (!downloadedData || downloadedData.length === 0) {
        debugLog('❌ Nessun dato da processare');
        return;
    }
    try {
        console.log(`🔄 Iniziando processing di ${downloadedData.length} candele con logica.js...`);
        showLoadingMessage('Processing candele...');
        resetState();
        let processedCount = 0;
        let errorCount = 0;
        downloadedData.forEach((candle, index) => {
            try {
                const result = processNewCandle(candle, CONFIG.currentSymbol.toLowerCase());
                if (result) {
                    processedCount++;
                    if (CONFIG.debugMode && index % 50 === 0) {
                        console.log(`📈 Candela ${index}: ${candle.close.toFixed(2)} -> Signal: ${result.signal}`);
                    }
                } else {
                    errorCount++;
                }
                if (index > 0 && index % 100 === 0) {
                    debugLog(`Processing: ${index}/${downloadedData.length} candele`);
                }
            } catch (error) {
                errorCount++;
                if (errorCount < 5) console.error(`❌ Errore processing candela ${index}:`, error);
            }
        });
        hideLoadingMessage();
        console.log(`✅ Processing completato: ${processedCount} successi, ${errorCount} errori`);
        if (processedCount > 0) {
            showStatusMessage(`✅ ${processedCount} candele processate!`, 'success');
            refreshData();
        } else {
            showStatusMessage(`❌ Nessuna candela processata correttamente`, 'error');
        }
    } catch (error) {
        hideLoadingMessage();
        debugError('Errore processing generale:', error);
        showStatusMessage(`❌ Errore processing: ${error.message}`, 'error');
    }
}

// =================== SETUP EVENTI ===================

function setupEventListeners() {
    const cryptoSelect = document.getElementById('cryptoSelect');
    if (cryptoSelect) {
        cryptoSelect.addEventListener('change', changeSymbol);
        console.log('✅ Event listener per cryptoSelect aggiunto');
    } else {
        console.warn('⚠️ cryptoSelect non trovato per event listener');
    }
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileUpload);
        console.log('✅ Event listeners per upload aggiunti');
    } else {
        console.warn('⚠️ uploadBtn o fileInput non trovati');
    }
}

// =================== INIZIALIZZAZIONE ===================

function initApp() {
    console.log('🚀 Inizializzazione applicazione...');
    try {
        const selectPopulated = populateCryptoSelect();
        if (!selectPopulated) {
            showStatusMessage('❌ Errore inizializzazione select', 'error');
            return;
        }
        updateDownloadButton();
        setupCopyLinkButton();
        resetState();
        refreshData();
        setupEventListeners();
        console.log('✅ Applicazione inizializzata correttamente');
        showStatusMessage('✅ Dashboard pronta! Seleziona una crypto e carica un file JSON', 'success');
    } catch (error) {
        console.error('❌ Errore inizializzazione:', error);
        showStatusMessage('❌ Errore inizializzazione applicazione', 'error');
    }
}

// Avvio app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
