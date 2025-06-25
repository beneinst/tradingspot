// ================= CONFIGURAZIONE MULTI-SIMBOLO =================
import { processNewCandle, getStateInfo, updateDashboardUI } from './logica.js';

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
                loadingEl.style0.display = 'none';
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

// ================= GESTIONeE DATI (SOLO UPLOAD JSON) =================

// Funzione per gestire l'upload del file JSON
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    showLoadingMessage(`Caricamento file ${file.name} in corso...`);
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            // Qui puoi processare i dati caricati, ad esempio:
            data.forEach(candle => {
                processNewCandle(candle, CONFIG.currentSymbol);
            });
            updateDashboardUI();
            showLoadingMessage(`✅ File ${file.name} caricato con successo`);
        } catch (error) {
            debugError(`Errore caricamento file: ${error.message}`);
            showLoadingMessage(`❌ Errore caricamento file`, 'error');
        }
    };
    reader.onerror = function(error) {
        debugError(`Errore lettura file: ${error.target.error}`);
        showLoadingMessage(`❌ Errore lettura file`, 'error');
    };
    reader.readAsText(file);
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

// ================= GESTIONE EVENTI =================
document.addEventListener('DOMContentLoaded', populateCryptoSelect);

const cryptoSelect = document.getElementById('cryptoSelect');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');

if (cryptoSelect) cryptoSelect.addEventListener('change', changeSymbol);
if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput.click());
if (fileInput) fileInput.addEventListener('change', handleFileUpload);

// ================= AVVIO =================
debugLog('🎯 APPLICAZIONE TRADING PRONTA');
showLoadingMessage('Seleziona una criptovaluta e carica un file JSON per iniziare');
