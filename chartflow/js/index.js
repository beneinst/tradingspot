
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
// Funzioni ----- let autoRefreshInterval = null;


   // Variabili globali
        let isAutoRefreshActive = false;
        let downloadedData = null;

        // Funzioni di debug
        function debugLog(message, data = null) {
    // Log su console
    const timestamp = new Date().toISOString();
    if (data) {
        console.log(`[${timestamp}] ${message}`, data);
    } else {
        console.log(`[${timestamp}] ${message}`);
    }

    // Log su HTML (opzionale)
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

// ================= UI HELPERS =================
function showStatusMessage(message, type = 'info') {
    const statusDiv = document.getElementById('statusMessage');
    if (statusDiv) {
        statusDiv.innerHTML = `<div class="status-message status-${type}">${message}</div>`;
        debugLog(`Status: ${message}`);
    }
}

function hideLoadingMessage() {
    const loadingDiv = document.getElementById('loadingMessage');
    if (loadingDiv) loadingDiv.style.display = 'none';
}

   // Mostra/nascondi messaggi di stato
       
        function showLoadingMessage(message) {
            const loadingDiv = document.getElementById('loadingMessage');
            loadingDiv.textContent = message;
            loadingDiv.style.display = 'block';
            debugLog(`Loading: ${message}`);
        }


// ================= DASHBOARD UI =================
function updateDashboardUI() {
    // Aggiorna la dashboard con i dati più recenti
    // Esempio: mostra l'ultimo prezzo, indicatori, ecc.
    const priceEl = document.getElementById('currentPrice');
    const rsiEl = document.getElementById('rsiValue');
    const smaEl = document.getElementById('smaValue');
    const emaEl = document.getElementById('emaValue');

    if (priceEl && rsiEl && smaEl && emaEl) {
        // Qui puoi usare i dati dallo state di logica.js, se necessario
        // Oppure aggiornare con valori statici di esempio
        priceEl.textContent = '---';
        rsiEl.textContent = '---';
        smaEl.textContent = '---';
        emaEl.textContent = '---';
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


// ================= CAMBIO SIMBOLO =================
async function changeSymbol() {
    const selectEl = document.getElementById('cryptoSelect');
    if (!selectEl) return;
    const newSymbol = selectEl.value;
    if (newSymbol === CONFIG.currentSymbol) return;
    debugLog(`Cambio simbolo: ${CONFIG.currentSymbol} -> ${newSymbol}`);
    CONFIG.currentSymbol = newSymbol;
    if (websocket) websocket.close();
    showLoadingMessage(`📊 Selezionato ${newSymbol.toUpperCase()} (carica un file JSON per i dati)`);
    // Non carica automaticamente dati, aspetta l'upload JSON
}



// ================= AVVIO =================
debugLog('🎯 APPLICAZIONE TRADING PRONTA');
showLoadingMessage('Seleziona una criptovaluta e carica un file JSON per iniziare');


 // Scarica dati da Binance API
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
        // API Binance per dati storici (500 candele 4h)
        const url = `https://api.binance.com/api/v3/klines?symbol=${CONFIG.currentSymbol}&interval=4h&limit=500`;
        debugLog(`URL API: ${url}`);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        debugLog(`Ricevuti ${data.length} record da Binance`);

        if (!data || data.length === 0) {
            throw new Error('Nessun dato ricevuto da Binance');
        }

        // Converti i dati nel formato standard
        downloadedData = data.map((k, index) => ({
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
        showStatusMessage(
            `✅ Dati scaricati con successo! ${downloadedData.length} candele 4h per ${CONFIG.currentSymbol}`,
            'success'
        );

        // Prova a passare i dati a logica.js se disponibile
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

// Associa l'evento al bottone (una sola volta)
const downloadBtn = document.getElementById('downloadBtn');
if (downloadBtn) downloadBtn.addEventListener('click', downloadBinanceData);



        // Processa i dati scaricati con logica.js
        function processDownloadedData() {
            if (!downloadedData || downloadedData.length === 0) {
                debugLog('Nessun dato da processare');
                return;
            }

            try {
                debugLog('Iniziando processing con logica.js...');
                
                downloadedData.forEach((candle, index) => {
                    processNewCandle(candle, currentSymbol.toLowerCase());
                    
                    // Log di progresso ogni 100 candele
                    if (index > 0 && index % 100 === 0) {
                        debugLog(`Processate ${index}/${downloadedData.length} candele`);
                    }
                });

                debugLog('Processing completato');
                showStatusMessage('✅ Dati processati con logica.js!', 'success');
                
                // Aggiorna la UI se possibile
                if (typeof refreshData === 'function') {
                    refreshData();
                }

            } catch (error) {
                debugLog(`Errore processing: ${error.message}`);
                showStatusMessage(`❌ Errore processing: ${error.message}`, 'error');
            }
        }

        // Trigger file upload
        function triggerFileUpload() {
            debugLog('Triggering file upload...');
            document.getElementById('fileInput').click();
        }

        // Gestisci upload file
        function handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file) {
                debugLog('Nessun file selezionato');
                return;
            }

            debugLog(`File selezionato: ${file.name} (${file.size} bytes)`);

            if (!currentSymbol) {
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
                    
                    // Riconosci il formato dei dati
                    let candles;
                    if (Array.isArray(rawData) && rawData.length > 0) {
                        const firstItem = rawData[0];
                        
                        // Formato Binance (array di array)
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
}
// Formato oggetti (già convertito)
else if (typeof firstItem === 'object' && firstItem.timestamp) {
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
}
// Formato con nomi diversi (es. time invece di timestamp)
else if (typeof firstItem === 'object' && (firstItem.time || firstItem.date)) {
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
}
// Formato sconosciuto - tentativo di auto-rilevamento
else {
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

// Validazione e ordinamento dei dati
if (!candles || candles.length === 0) {
    throw new Error('Nessuna candela valida trovata nei dati');
}

// Rimuovi candele con dati invalidi
candles = candles.filter(candle => 
    candle.timestamp && 
    !isNaN(candle.open) && 
    !isNaN(candle.high) && 
    !isNaN(candle.low) && 
    !isNaN(candle.close)
);

// Ordina per timestamp
candles.sort((a, b) => a.timestamp - b.timestamp);

debugLog(`Processate ${candles.length} candele valide`);
return candles;


// ================= GESTIONE EVENgTI =================
document.addEventListener('DOMContentLoaded', populateCryptoSelect);
const cryptoSelect = document.getElementById('cryptoSelect');
if (cryptoSelect) cryptoSelect.addEventListener('change', changeSymbol);
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput.click());
if (fileInput) fileInput.addEventListener('change', handleFileUpload);