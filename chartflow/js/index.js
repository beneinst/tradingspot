// =================== CONFIGURAZIONE MULTI-SIMBOLO ===================
import { getCurrentState, resetState } from './logica.js';


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
    select.value = CONFIG.currentSymbol;
}

// =================== AGGIORNA LA DASHBOARD ===================
function refreshData() {
    // Ottieni lo stato corrente (puoi usare getCurrentState o getStateInfo, a seconda di cosa ti serve)
    const state = getCurrentState();
    debugLog('refreshData - getCurrentState:', state);
    if (!state) return;

    // Estrai gli indicatori principali dal risultato di processNewCandle
    // Nota: nella nuova logica, gli indicatori sono in state.indicators
    // Se vuoi visualizzare anche i dettagli di ogni indicatore, puoi accedere a state.indicators
    // Qui faccio un esempio base con i dati principali
    const indicators = state.indicators || {};
    const mainSignal = state.signal || "NONE";
    const timerCount = state.timerCount || 0;
    const signalStartIndex = state.signalStartIndex || -1;

    // Mappa gli indicatori principali agli elementi HTML
    // Aggiungi qui tutti gli indicatori che vuoi visualizzare nella dashboard
    // Nota: alcuni indicatori potrebbero non essere presenti, quindi usa ?. per evitare errori
    const elementsToUpdate = {
        'mainSignal': mainSignal,
        'timerStatus': mainSignal !== "NONE" ? "ATTIVO" : "NESSUN OK",
        'timerProgress': mainSignal !== "NONE" ? `${timerCount}/${config.timerPeriods}` : "0/12",
        'confluenceScore': indicators.confluence?.score?.toFixed(2) || "0.00",
        'score': indicators.confluence?.score?.toFixed(2) || "0.00",
        'bbPosition': indicators.bb?.position?.toFixed(2) || "0.00",
        'bbUpper': indicators.bb?.upper?.toFixed(2) || "0.00",
        'bbLower': indicators.bb?.lower?.toFixed(2) || "0.00",
        'bbBasis': indicators.bb?.basis?.toFixed(2) || "0.00",
        'stochK': indicators.stoch?.k?.toFixed(2) || "0.00",
        'stochD': "0.00", // Se non calcolato, lascia 0.00
        'rsi': indicators.ma?.rsi?.toFixed(2) || "0.00",
        'ema': indicators.ma?.ema?.toFixed(2) || "0.00",
        'sma': indicators.ma?.sma?.toFixed(2) || "0.00",
        'currentPrice': indicators.ma?.currentPrice?.toFixed(2) || "0.00", // Nota: currentPrice potrebbe non essere in ma, adatta se necessario
        'linreg': indicators.linreg?.toFixed(2) || "0.00",
        'pearson': indicators.pearsonR?.toFixed(2) || "0.00",
        'candles': state.prices?.length || "0",
        'macdStatus': indicators.macd?.histogram > 0 ? "BULLISH" : indicators.macd?.histogram < 0 ? "BEARISH" : "NEUTRO",
        'momentumStatus': indicators.momentum?.score > 0 ? "BULLISH" : indicators.momentum?.score < 0 ? "BEARISH" : "NEUTRO",
        'trendStatus': indicators.ma?.trend > 0 ? "BULLISH" : indicators.ma?.trend < 0 ? "BEARISH" : "NEUTRO",
        'paStatus': indicators.priceAction?.pattern > 0 ? "BULLISH" : indicators.priceAction?.pattern < 0 ? "BEARISH" : "NEUTRO",
        'linregCheck': Math.abs(indicators.linreg) >= config.linregThreshold ? "✔️" : "❌",
        'pearsonCheck': Math.abs(indicators.pearsonR) >= 0.5 ? "✔️" : "❌",
        'secondaryCheck': "0/4", // Puoi calcolare il numero di indicatori secondari positivi, adatta se necessario
        'lastSignalTime': signalStartIndex !== -1 ? new Date(state.timestamps[signalStartIndex]).toLocaleString() : "--",
        'lastSignalType': mainSignal !== "NONE" ? mainSignal : "--",
        'barsElapsed': mainSignal !== "NONE" ? timerCount : "--",
        'barsRemaining': mainSignal !== "NONE" ? (config.timerPeriods - timerCount) : "--",
        'patterns': indicators.priceAction?.type || "Nessun pattern",
        'signalStrength': indicators.confluence?.score?.toFixed(2) || "0.00"
    };

    // Aggiorna gli elementi e registra eventuali problemi
    for (const [elementId, value] of Object.entries(elementsToUpdate)) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = value;
            debugLog(`✅ Aggiornato ${elementId}: ${value}`);
        } else {
            debugLog(`❌ Elemento non trovato: ${elementId}`);
        }
    }

    // Aggiornamento speciale per lo stato "isStale"
    const staleEl = document.getElementById('isStale');
    if (staleEl) {
        const isStale = false; // Puoi calcolare isStale in base ai tuoi criteri
        staleEl.textContent = isStale ? 'STALE' : 'FRESCO';
        staleEl.style.color = isStale ? '#ff4d4d' : '#26ff8a';
    }

    // Aggiorna la classe di confluenceScore in base al valore
    const scoreEl = document.getElementById('confluenceScore');
    if (scoreEl) {
        const scoreValue = Number(indicators.confluence?.score || 0);
        if (scoreValue > 0.5) {
            scoreEl.className = 'confluence-score score-positive';
        } else if (scoreValue < -0.5) {
            scoreEl.className = 'confluence-score score-negative';
        } else {
            scoreEl.className = 'confluence-score score-neutral';
        }
    }
}

// =================== CAMBIO SIMBOLO ===================
function changeSymbol() {
    const selectEl = document.getElementById('cryptoSelect');
    if (!selectEl) return;
    const newSymbol = selectEl.value;
    if (newSymbol === CONFIG.currentSymbol) return;
    debugLog(`Cambio simbolo: ${CONFIG.currentSymbol} -> ${newSymbol}`);
    CONFIG.currentSymbol = newSymbol;

    // Ora non carichiamo più lo stato da localStorage, ma aggiorniamo semplicemente la dashboard
    debugLog('Simbolo cambiato:', CONFIG.currentSymbol);
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
        // Converti il simbolo in maiuscolo
        const symbol = currentCoin.value.toUpperCase();
        const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=4h&limit=500`;
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

    // Inizia con stato vuoto
    resetState(); // Opzionale, se vuoi resettare lo stato
    debugLog('Stato inizializzato');
    refreshData();

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

// Nota: config.timerPeriods va definito se non lo usi dal modulo logica.js
// Se logica.js non lo espone, puoi aggiungerlo qui
const config = { timerPeriods: 12 };
