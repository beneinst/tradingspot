import { processNewCandle, loadState, saveState, getStateInfo, resetState, getLastIndicators } from './logica.js';

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
    currentSymbol: 'BTCUSDT',
    interval: '4h',
    maxRetries: 3,
    retryDelay: 5000,
    historyLimit: 200,
    debugMode: true
};

let downloadedData = null;

// =================== FUNZIONE PER TROVARE LA MONETA CORRENTE ===================
function getCurrentCoin() {
    return COINS.find(coin => coin.value.toLowerCase() === CONFIG.currentSymbol.toLowerCase());
}

// =================== DEBUG & UI HELPERS ===================
function showLoadingMessage(message) {
    let loadingDiv = document.getElementById('loadingMessage');
    if (!loadingDiv) {
        loadingDiv = document.createElement('div');
        loadingDiv.id = 'loadingMessage';
        loadingDiv.style.position = 'fixed';
        loadingDiv.style.top = '20px';
        loadingDiv.style.left = '50%';
        loadingDiv.style.transform = 'translateX(-50%)';
        loadingDiv.style.background = '#232a34';
        loadingDiv.style.color = '#ffc200';
        loadingDiv.style.padding = '12px 28px';
        loadingDiv.style.borderRadius = '8px';
        loadingDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.18)';
        loadingDiv.style.zIndex = '9999';
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
        statusDiv.style.position = 'fixed';
        statusDiv.style.bottom = '20px';
        statusDiv.style.left = '50%';
        statusDiv.style.transform = 'translateX(-50%)';
        statusDiv.style.background = type === 'error' ? '#ff4d4d' : type === 'success' ? '#26ff8a' : '#232a34';
        statusDiv.style.color = type === 'error' ? '#fff' : type === 'success' ? '#222831' : '#ffc200';
        statusDiv.style.padding = '12px 28px';
        statusDiv.style.borderRadius = '8px';
        statusDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.18)';
        statusDiv.style.zIndex = '9999';
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
        const msg = data ? `${message}: ${JSON.stringify(data)}` : message;
        debugDiv.innerHTML += `<div>${new Date().toTimeString().split(' ')[0]} - ${msg}</div>`;
        debugDiv.scrollTop = debugDiv.scrollHeight;
    }
}

function debugError(message, error = null) {
    debugLog(`❌ ERROR: ${message}`, error);
}

// =================== POPOLAMENTO SELECT ===================
function populateCryptoSelect() {
    const select = document.getElementById('cryptoSelect');
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Seleziona una criptovaluta...</option>';
    COINS.forEach(coin => {
        const option = document.createElement('option');
        option.value = coin.value;
        option.textContent = coin.label;
        select.appendChild(option);
    });
    select.value = CONFIG.currentSymbol.toLowerCase();
}

// =================== CAMBIO SIMBOLO ===================
function changeSymbol() {
    const selectEl = document.getElementById('cryptoSelect');
    if (!selectEl) return;
    const newSymbol = selectEl.value.toUpperCase();
    if (newSymbol === CONFIG.currentSymbol) return;
    debugLog(`Cambio simbolo: ${CONFIG.currentSymbol} -> ${newSymbol}`);
    CONFIG.currentSymbol = newSymbol;

    // Aggiorna il pulsante di download con il link statico
    updateDownloadButton();

    // Carica lo stato persistente per il nuovo simbolo
    if (loadState(CONFIG.currentSymbol)) {
        debugLog('Stato caricato da localStorage per', CONFIG.currentSymbol);
        refreshData();
    } else {
        debugLog('Nessuno stato precedente trovato per', CONFIG.currentSymbol);
        refreshData();
    }

    showLoadingMessage(`📊 Selezionato ${newSymbol} - Clicca su "Scarica Dati" per ottenere i dati aggiornati`);
}

// =================== AGGIORNA PULSANTE DOWNLOAD ===================
function updateDownloadButton() {
    const downloadBtn = document.getElementById('downloadBtn');
    if (!downloadBtn) return;
    const currentCoin = getCurrentCoin();
    if (currentCoin && currentCoin.dataUrl) {
        downloadBtn.disabled = false;
        downloadBtn.textContent = `📥 Scarica ${currentCoin.label}`;
        downloadBtn.title = `Scarica dati da: ${currentCoin.dataUrl}`;
    } else {
        downloadBtn.disabled = true;
        downloadBtn.textContent = '📥 Link non disponibile';
        downloadBtn.title = 'Nessun link statico configurato per questa criptovaluta';
    }
}

// =================== SCARICA DATI DA LINK STATICO ===================
async function downloadStaticData() {
    const currentCoin = getCurrentCoin();
    if (!currentCoin || !currentCoin.dataUrl) {
        showStatusMessage('Nessun link statico configurato per questa criptovaluta!', 'error');
        return;
    }

    const downloadBtn = document.getElementById('downloadBtn');
    downloadBtn.disabled = true;
    downloadBtn.textContent = '⏳ Scaricando...';

    showLoadingMessage(`Scaricando dati da link statico per ${currentCoin.label}...`);
    debugLog(`Scaricando da: ${currentCoin.dataUrl}`);

    try {
        const response = await fetch(currentCoin.dataUrl);
        if (!response.ok) throw new Error(`Errore HTTP: ${response.status} - ${response.statusText}`);
        const data = await response.json();
        debugLog(`Ricevuti ${Array.isArray(data) ? data.length : 'N/A'} record dal link statico`);

        if (!data || (Array.isArray(data) && data.length === 0)) {
            throw new Error('Nessun dato ricevuto dal link statico');
        }

        // Converti i dati nel formato standard
        let candles;
        if (Array.isArray(data)) {
            const firstItem = data[0];
            if (Array.isArray(firstItem) && firstItem.length >= 6) {
                candles = data.map(k => ({
                    timestamp: k[0],
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4]),
                    volume: parseFloat(k[5]),
                    closed: true
                }));
            } else if (typeof firstItem === 'object' && firstItem.timestamp) {
                candles = data.map(k => ({
                    timestamp: k.timestamp,
                    open: parseFloat(k.open),
                    high: parseFloat(k.high),
                    low: parseFloat(k.low),
                    close: parseFloat(k.close),
                    volume: parseFloat(k.volume || 0),
                    closed: k.closed !== undefined ? k.closed : true
                }));
            } else {
                throw new Error('Formato dati nel file statico non riconosciuto');
            }
        } else {
            throw new Error('I dati dal link statico non sono in formato array');
        }

        downloadedData = candles;
        debugLog(`Convertite ${downloadedData.length} candele dal link statico`);

        hideLoadingMessage();
        showStatusMessage(`✅ Dati scaricati con successo! ${downloadedData.length} candele per ${currentCoin.label}`, 'success');

        if (typeof processNewCandle === 'function') {
            debugLog('logica.js trovato, processando dati...');
            processDownloadedData();
        } else {
            debugLog('logica.js non trovato - dati pronti per il caricamento manuale');
            showStatusMessage('Dati pronti! logica.js non caricato automaticamente.', 'warning');
        }
    } catch (error) {
        debugError(`Errore download da link statico: ${error.message}`);
        hideLoadingMessage();
        showStatusMessage(`❌ Errore nel download: ${error.message}`, 'error');
    } finally {
        downloadBtn.disabled = false;
        updateDownloadButton();
    }
}

// =================== PROCESSA DATI SCARICATI ===================
function processDownloadedData() {
    if (!downloadedData || downloadedData.length === 0) {
        debugLog('Nessun dato da processare');
        return;
    }
    try {
        debugLog('Iniziando processing con logica.js...');
        downloadedData.forEach((candle, index) => {
            processNewCandle(candle, CONFIG.currentSymbol.toLowerCase());
            if (index > 0 && index % 100 === 0) {
                debugLog(`Processate ${index}/${downloadedData.length} candele`);
            }
        });
        debugLog('Processing completato');
        showStatusMessage('✅ Dati processati con logica.js!', 'success');
        saveState(CONFIG.currentSymbol);
        refreshData();
    } catch (error) {
        debugError(`Errore processing: ${error.message}`);
        showStatusMessage(`❌ Errore processing: ${error.message}`, 'error');
    }
}

// =================== HANDLE FILE UPLOAD ===================
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        debugLog('Nessun file selezionato');
        return;
    }
    debugLog(`File selezionato: ${file.name} (${file.size} bytes)`);

    if (!CONFIG.currentSymbol) {
        showStatusMessage('Seleziona prima una criptovaluta!', 'error');
        return;
    }

    showLoadingMessage('Caricando e processando file...');

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            debugLog('Parsing JSON file...');
            const rawData = JSON.parse(e.target.result);
            debugLog(`JSON parsato: ${rawData.length} elementi`);

            let candles;
            if (Array.isArray(rawData) && rawData.length > 0) {
                const firstItem = rawData[0];
                if (Array.isArray(firstItem) && firstItem.length >= 6) {
                    debugLog('Riconosciuto formato Binance (array di array)');
                    candles = rawData.map(k => ({
                        timestamp: k[0],
                        open: parseFloat(k[1]),
                        high: parseFloat(k[2]),
                        low: parseFloat(k[3]),
                        close: parseFloat(k[4]),
                        volume: parseFloat(k[5]),
                        closed: true
                    }));
                } else if (typeof firstItem === 'object' && firstItem.timestamp) {
                    debugLog('Riconosciuto formato oggetti');
                    candles = rawData.map(k => ({
                        timestamp: k.timestamp,
                        open: parseFloat(k.open),
                        high: parseFloat(k.high),
                        low: parseFloat(k.low),
                        close: parseFloat(k.close),
                        volume: parseFloat(k.volume),
                        closed: k.closed !== undefined ? k.closed : true
                    }));
                } else {
                    throw new Error('Formato dati non riconosciuto nel file caricato');
                }
            }

            if (!candles || candles.length === 0) {
                throw new Error('Nessuna candela valida trovata nei dati');
            }

            candles = candles.filter(candle =>
                candle.timestamp &&
                !isNaN(candle.open) &&
                !isNaN(candle.high) &&
                !isNaN(candle.low) &&
                !isNaN(candle.close)
            );
            candles.sort((a, b) => a.timestamp - b.timestamp);

            debugLog(`Processate ${candles.length} candele valide dal file`);
            downloadedData = candles;
            hideLoadingMessage();
            showStatusMessage(`✅ File caricato con successo! ${candles.length} candele`, 'success');

            if (typeof processNewCandle === 'function') {
                debugLog('logica.js trovato, processando dati...');
                processDownloadedData();
            } else {
                debugLog('logica.js non trovato - dati pronti per il caricamento manuale');
                showStatusMessage('Dati pronti! logica.js non caricato automaticamente.', 'warning');
            }
        } catch (error) {
            debugError('Errore processamento file:', error);
            hideLoadingMessage();
            showStatusMessage(`❌ Errore nel processamento del file: ${error.message}`, 'error');
        }
    };
    reader.readAsText(file);
}

// =================== INIZIALIZZAZIONE ===================
function initApp() {
    populateCryptoSelect();
    updateDownloadButton();

    // Carica stato persistente all'avvio
    if (loadState(CONFIG.currentSymbol)) {
        debugLog('Stato caricato da localStorage per', CONFIG.currentSymbol);
        refreshData();
    }

    // Event listeners
    const cryptoSelect = document.getElementById('cryptoSelect');
    if (cryptoSelect) cryptoSelect.addEventListener('change', changeSymbol);

    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) downloadBtn.addEventListener('click', downloadStaticData);

    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    if (uploadBtn && fileInput) uploadBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', handleFileUpload);

    debugLog('🎯 APPLICAZIONE TRADING PRONTA CON LINK STATICI');
    showLoadingMessage('Seleziona una criptovaluta e clicca su "Scarica Dati" per ottenere i dati dal link statico');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
