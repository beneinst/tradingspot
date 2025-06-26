// =================== CONFIGURAZIONE MULTI-SIMBOLO ===================
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

function getCurrentCoin() {
    return COINS.find(coin => coin.value.toLowerCase() === CONFIG.currentSymbol.toLowerCase());
}


let downloadedData = null;

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
    select.value = CONFIG.currentSymbol;
}

// =================== AGGIORNA LA DASHBOARD ===================
function refreshData() {
    const info = getLastIndicators();
    debugLog('refreshData - getLastIndicators:', info);
    if (!info || info.error) return;
    // ... (aggiornamento delle card e dei timer come in precedenza) ...
}

// =================== CAMBIO SIMBOLO ===================
function changeSymbol() {
    const selectEl = document.getElementById('cryptoSelect');
    if (!selectEl) return;
    const newSymbol = selectEl.value;
    if (newSymbol === CONFIG.currentSymbol) return;
    debugLog(`Cambio simbolo: ${CONFIG.currentSymbol} -> ${newSymbol}`);
    CONFIG.currentSymbol = newSymbol;

    // Carica lo stato persistente per il nuovo simbolo
    if (loadState(CONFIG.currentSymbol)) {
        debugLog('Stato caricato da localStorage per', CONFIG.currentSymbol);
        refreshData();
    } else {
        debugLog('Nessuno stato precedente trovato per', CONFIG.currentSymbol);
        refreshData();
    }

    // Aggiorna il pulsante e il link di download
    updateDownloadButton();
    showLoadingMessage(`📊 Selezionato ${newSymbol.toUpperCase()} (scarica o carica un file JSON per i dati)`);
}

// =================== AGGIORNA PULSANTE E LINK DI DOWNLOAD ===================
function updateDownloadButton() {
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadLinkField = document.getElementById('downloadLink');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const currentCoin = getCurrentCoin();

    if (currentCoin) {
        const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${currentCoin.value}&interval=4h&limit=500`;
        if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.textContent = `📥 Scarica ${currentCoin.label}`;
            downloadBtn.title = `Scarica dati da Binance: ${binanceUrl}`;
            downloadBtn.onclick = () => {
                window.open(binanceUrl, '_blank');
                showStatusMessage(`Link di ${currentCoin.label} aperto in una nuova finestra`, 'success');
            };
        }
        if (downloadLinkField) {
            downloadLinkField.value = binanceUrl;
            downloadLinkField.style.display = 'block';
        }
        if (copyLinkBtn) {
            copyLinkBtn.style.display = 'block';
        }
    } else {
        if (downloadBtn) {
            downloadBtn.disabled = true;
            downloadBtn.textContent = '📥 Link non disponibile';
            downloadBtn.title = 'Nessun link configurato per questa criptovaluta';
        }
        if (downloadLinkField) {
            downloadLinkField.style.display = 'none';
        }
        if (copyLinkBtn) {
            copyLinkBtn.style.display = 'none';
        }
    }
}

// =================== COPIA LINK DI DOWNLOAD ===================
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
                } else if (typeof firstItem === 'object' && (firstItem.time || firstItem.date)) {
                    debugLog('Riconosciuto formato con time/date');
                    candles = rawData.map(k => ({
                        timestamp: k.time || k.date,
                        open: parseFloat(k.open || k.o),
                        high: parseFloat(k.high || k.h),
                        low: parseFloat(k.low || k.l),
                        close: parseFloat(k.close || k.c),
                        volume: parseFloat(k.volume || k.v || 0),
                        closed: k.closed !== undefined ? k.closed : true
                    }));
                } else {
                    debugLog('Formato non riconosciuto, tentativo auto-rilevamento:', firstItem);
                    if (typeof firstItem === 'object') {
                        const keys = Object.keys(firstItem);
                        const timestampKey = keys.find(key =>
                            key.toLowerCase().includes('time') ||
                            key.toLowerCase().includes('date') ||
                            key === 'ts' || key === 't'
                        );
                        const openKey = keys.find(key => key.toLowerCase().includes('open') || key === 'o');
                        const highKey = keys.find(key => key.toLowerCase().includes('high') || key === 'h');
                        const lowKey = keys.find(key => key.toLowerCase().includes('low') || key === 'l');
                        const closeKey = keys.find(key => key.toLowerCase().includes('close') || key === 'c');
                        const volumeKey = keys.find(key => key.toLowerCase().includes('volume') || key === 'v');
                        if (timestampKey && openKey && highKey && lowKey && closeKey) {
                            debugLog(`Auto-rilevamento riuscito: ${timestampKey}, ${openKey}, ${highKey}, ${lowKey}, ${closeKey}`);
                            candles = rawData.map(k => ({
                                timestamp: k[timestampKey],
                                open: parseFloat(k[openKey]),
                                high: parseFloat(k[highKey]),
                                low: parseFloat(k[lowKey]),
                                close: parseFloat(k[closeKey]),
                                volume: volumeKey ? parseFloat(k[volumeKey]) : 0,
                                closed: true
                            }));
                        } else {
                            throw new Error('Formato dati non riconosciuto. Chiavi disponibili: ' + keys.join(', '));
                        }
                    } else {
                        throw new Error('Formato dati non supportato: ' + typeof firstItem);
                    }
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

            debugLog(`Processate ${candles.length} candele valide`);
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
        debugLog(`Errore processing: ${error.message}`);
        showStatusMessage(`❌ Errore processing: ${error.message}`, 'error');
    }
}

// =================== INIZIALIZZAZIONE ===================
function initApp() {
    populateCryptoSelect();
    updateDownloadButton();
    setupCopyLinkButton();

    // Carica stato persistente all'avvio
    if (loadState(CONFIG.currentSymbol)) {
        debugLog('Stato caricato da localStorage per', CONFIG.currentSymbol);
        refreshData();
    }

    // Event listeners
    const cryptoSelect = document.getElementById('cryptoSelect');
    if (cryptoSelect) cryptoSelect.addEventListener('change', changeSymbol);

    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    if (uploadBtn && fileInput) uploadBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', handleFileUpload);

    debugLog('🎯 APPLICAZIONE TRADING PRONTA');
    showLoadingMessage('Seleziona una criptovaluta, scarica o carica un file JSON per iniziare');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
