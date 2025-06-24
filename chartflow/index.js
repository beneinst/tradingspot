import { processNewCandle, addTick, state } from './logica.js';

let socket = null;
let currentSymbol = 'btcusdt';

async function loadHistoricalData(symbol) {
    try {
        const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=1m&limit=100`);
        const data = await response.json();

        // Azzera i dati precedenti
        state.prices = [];
        state.highs = [];
        state.lows = [];
        state.opens = [];

        data.forEach(candle => {
            addTick(parseFloat(candle[1]), parseFloat(candle[2]), parseFloat(candle[3]), parseFloat(candle[4]));
        });

        console.log('Dati storici caricati per', symbol);
    } catch (error) {
        console.error('Errore nel caricamento dei dati storici:', error);
    }
}

function connectBinance(symbol) {
    if (socket) socket.close();

    socket = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@kline_1m`);
    console.log('Connesso a Binance per', symbol);

    socket.onmessage = function (event) {
        const message = JSON.parse(event.data);
        const candlestick = message.k;

        // Solo se la candela è chiusa
        if (candlestick.x) {
            const candle = {
                time: candlestick.t,
                open: parseFloat(candlestick.o),
                high: parseFloat(candlestick.h),
                low: parseFloat(candlestick.l),
                close: parseFloat(candlestick.c)
            };
            const calculations = processNewCandle(candle);
            console.log("Calcoli ricevuti:", calculations);

            if (calculations) {
                updateDashboard(calculations);
            }
        }
    };

    socket.onclose = function () {
        console.log('Connessione chiusa per', symbol);
    };
}

function changeSymbol() {
    const select = document.getElementById('cryptoSelect');
    currentSymbol = select.value;

    loadHistoricalData(currentSymbol).then(() => {
        connectBinance(currentSymbol);
    });
}

function updateDashboard(calculations) {
    document.getElementById('linregValue').innerText = calculations.linreg.toFixed(2);
    document.getElementById('pearsonValue').innerText = calculations.pearson.toFixed(2);
    document.getElementById('bbValue').innerText = calculations.bb.toFixed(2);
    document.getElementById('stochValue').innerText = calculations.stoch.toFixed(2);
    document.getElementById('confluenceScore').innerText = calculations.score.toFixed(2);
    document.getElementById('lastUpdate').innerText = new Date().toLocaleTimeString();
}

function refreshData() {
    console.log('Refresh manuale richiesto.');
    // Puoi implementare un ricalcolo manuale se necessario
}

let autoRefresh = false;
let refreshInterval = null;

function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    const btn = document.getElementById('autoRefreshBtn');
    if (autoRefresh) {
        refreshInterval = setInterval(() => {
            console.log('Auto refresh...');
            // Puoi decidere se aggiungere logiche di refresh dati
        }, 60000);
        btn.innerText = '⏰ Auto Refresh: ON';
    } else {
        clearInterval(refreshInterval);
        btn.innerText = '⏰ Auto Refresh: OFF';
    }
}

// Esportiamo per accesso da HTML
window.connectBinance = connectBinance;
window.changeSymbol = changeSymbol;
window.updateDashboard = updateDashboard;
window.refreshData = refreshData;
window.toggleAutoRefresh = toggleAutoRefresh;

window.onload = function () {
    loadHistoricalData(currentSymbol).then(() => {
        connectBinance(currentSymbol);
    });
};
