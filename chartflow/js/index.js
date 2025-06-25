// =================== CONFIGURAZIONE MULTI-SIMBOLO ===================
import { processNewCandle, loadState, getStateInfo, resetState, getLastIndicators } from './logica.js';

const COINS = [
    { id: 'bitcoin', label: 'BTC/USDT', value: 'BTCUSDT', vs_currency: 'usd' },
    { id: 'cosmos', label: 'ATOM/USDT', value: 'ATOMUSDT', vs_currency: 'usd' },
    { id: 'ethereum', label: 'ETH/USDT', value: 'ETHUSDT', vs_currency: 'usd' },
    { id: 'fetch-ai', label: 'FET/USDC', value: 'FETUSDC', vs_currency: 'usd' },
    { id: 'solana', label: 'SOL/USDC', value: 'SOLUSDC', vs_currency: 'usd' },
    { id: 'binancecoin', label: 'BNB/USDC', value: 'BNBUSDC', vs_currency: 'usd' },
    { id: 'cardano', label: 'ADA/EUR', value: 'ADAEUR', vs_currency: 'eur' },
    { id: 'uniswap', label: 'UNI/USDC', value: 'UNIUSDC', vs_currency: 'usd' },
    { id: 'decentraland', label: 'MANA/USDT', value: 'MANAUSDT', vs_currency: 'usd' },
    { id: 'litecoin', label: 'LTC/USDT', value: 'LTCUSDT', vs_currency: 'usd' },
    { id: 'algorand', label: 'ALGO/USDT', value: 'ALGOUSDT', vs_currency: 'usd' },
    { id: 'avalanche-2', label: 'AVAX/USDT', value: 'AVAXUSDT', vs_currency: 'usd' },
    { id: 'avalanche-2', label: 'AVAX/USDC', value: 'AVAXUSDC', vs_currency: 'usd' },
    { id: 'polkadot', label: 'DOT/USDC', value: 'DOTUSDC', vs_currency: 'usd' },
    { id: 'near', label: 'NEAR/USDC', value: 'NEARUSDC', vs_currency: 'usd' },
    { id: 'suicoin', label: 'SUI/USDC', value: 'SUIUSDC', vs_currency: 'usd' }
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

// =================== DEBUG & UI HELPERS ===================
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
    const timestamp = new Date().toISOString();
    if (error) {
        console.error(`[${timestamp}] ERROR: ${message}`, error);
    } else {
        console.error(`[${timestamp}] ERROR: ${message}`);
    }
    showLoadingMessage(`❌ ${message}`, 'error');
}

function showStatusMessage(message, type = 'info') {
    const statusDiv = document.getElementById('statusMessage');
    if (statusDiv) {
        statusDiv.innerHTML = `<div class="status-message status-${type}">${message}</div>`;
        debugLog(`Status: ${message}`);
    }
}

function showLoadingMessage(message) {
    const loadingDiv = document.getElementById('loadingMessage');
    if (loadingDiv) {
        loadingDiv.textContent = message;
        loadingDiv.style.display = 'block';
        debugLog(`Loading: ${message}`);
    }
}

function hideLoadingMessage() {
    const loadingDiv = document.getElementById('loadingMessage');
    if (loadingDiv) loadingDiv.style.display = 'none';
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

    // Aggiorna solo se info è valido e non errore
    if (!info || info.error) return;

    // Segnale principale
    document.getElementById('confluenceScore').textContent = info.score ?? '0.0';

    // Indicatori principali
    document.getElementById('linregValue').textContent = info.linreg?.toFixed(4) ?? '0.00';
    document.getElementById('pearsonValue').textContent = info.pearson?.toFixed(4) ?? '0.00';
    document.getElementById('bbValue').textContent = info.bb?.toFixed(4) ?? '0.00';
    document.getElementById('stochValue').textContent = info.stochK?.toFixed(2) ?? '0.00';

    // Timer e altri dati (esempi, da adattare se hai logica specifica)
    // document.getElementById('timerStatus').textContent = info.timerStatus ?? 'NESSUN OK';
    // document.getElementById('timerProgress').textContent = info.timerProgress ?? '0/12';

    // Indicatori secondari (se li aggiungi in logica.js)
    // document.getElementById('macdStatus').textContent = info.macdStatus ?? 'NEUTRO';
    // document.getElementById('momentumStatus').textContent = info.momentumStatus ?? 'NEUTRO';
    // document.getElementById('trendStatus').textContent = info.trendStatus ?? 'NEUTRO';
    // document.getElementById('paStatus').textContent = info.paStatus ?? 'NEUTRO';
}

// =================== CAMBIO SIMBOLO ===================
function changeSymbol() {
    const selectEl = document.getElementById('cryptoSelect');
    if (!selectEl) return;
    const newSymbol = selectEl.value;
    if (newSymbol === CONFIG.currentSymbol) return;
    debugLog(`Cambio simbolo: ${CONFIG.currentSymbol} -> ${newSymbol}`);
    CONFIG.currentSymbol = newSymbol;
    showLoadingMessage(`📊 Selezionato ${newSymbol.toUpperCase()} (carica un file JSON per i dati)`);
}

// =================== SCARICA DATI BINANCE ===================
async function downloadBinanceData() {
    if (!CONFIG.currentSymbol) {
        showStatusMessage('Seleziona prima una criptovaluta!', 'error');
        return;
    }

    const downloadBtn = document.getElementById('downloadBtn');
    downloadBtn.disabled = true;
    downloadBtn.textContent = '⏳ Scaricando...';

    showLoadingMessage('Scaricando dati da Binance...');
    debugLog(`Iniziando download per ${CONFIG.currentSymbol}`);

    try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${CONFIG.currentSymbol}&interval=4h&limit=500`;
        debugLog(`URL API: ${url}`);

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Errore HTTP: ${response.status} - ${response.statusText}`);

        const data = await response.json();
        debugLog(`Ricevuti ${data.length} record da Binance`);

        if (!data || data.length === 0) throw new Error('Nessun dato ricevuto da Binance');

        downloadedData = data.map(k => ({
            timestamp: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            closed: true
        }));

        debugLog(`Convertite ${downloadedData.length} candele`);
        debugLog(`Prima candela: ${JSON.stringify(downloadedData[0])}`);
        debugLog(`Ultima candela: ${JSON.stringify(downloadedData[downloadedData.length - 1])}`);

        hideLoadingMessage();
        showStatusMessage(`✅ Dati scaricati con successo! ${downloadedData.length} candele 4h per ${CONFIG.currentSymbol}`, 'success');

        if (typeof processNewCandle === 'function') {
            debugLog('logica.js trovato, processando dati...');
            processDownloadedData();
        } else {
            debugLog('logica.js non trovato - dati pronti per il caricamento manuale');
            showStatusMessage('Dati pronti! logica.js non caricato automaticamente.', 'warning');
        }

    } catch (error) {
        debugLog(`Errore download: ${error.message}`);
        hideLoadingMessage();
        showStatusMessage(`❌ Errore nel download: ${error.message}`, 'error');
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.textContent = '📥 Scarica Dati';
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
        refreshData(); // <--- AGGIORNA LA DASHBOARD QUI
    } catch (error) {
        debugLog(`Errore processing: ${error.message}`);
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

// =================== INIZIALIZZAZIONE ===================
function initApp() {
    populateCryptoSelect();

    const cryptoSelect = document.getElementById('cryptoSelect');
    if (cryptoSelect) cryptoSelect.addEventListener('change', changeSymbol);

    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) downloadBtn.addEventListener('click', downloadBinanceData);

    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    if (uploadBtn && fileInput) uploadBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', handleFileUpload);

    debugLog('🎯 APPLICAZIONE TRADING PRONTA');
    showLoadingMessage('Seleziona una criptovaluta e carica un file JSON per iniziare');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
