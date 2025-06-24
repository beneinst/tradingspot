import { processNewCandle, addTick, state } from './logica.js';

let socket = null;
let currentSymbol = 'btcusdt';

// Carica storico 4H
async function loadHistoricalData(symbol) {
    try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=4h&limit=200`;
        const response = await fetch(url);
        const data = await response.json();

        // Reset dati
        state.prices = [];
        state.highs = [];
        state.lows = [];
        state.opens = [];

        data.forEach(candle => {
            // candle: [openTime, open, high, low, close, ...]
            addTick(
                parseFloat(candle[1]),
                parseFloat(candle[2]),
                parseFloat(candle[3]),
                parseFloat(candle[4])
            );
        });

        console.log(`Dati storici 4H caricati per ${symbol}`);
    } catch (error) {
        console.error('Errore caricamento dati storici:', error);
    }
}

// Connessione websocket 4H
function connectBinance(symbol) {
    if (socket) {
        socket.close();
        socket = null;
    }

    socket = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@kline_4h`);

    socket.onopen = () => {
        console.log(`WebSocket connesso per ${symbol}`);
    };

    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        const candlestick = message.k;

        if (candlestick.x) {  // candela chiusa
            const candle = {
                time: candlestick.t,
                open: parseFloat(candlestick.o),
                high: parseFloat(candlestick.h),
                low: parseFloat(candlestick.l),
                close: parseFloat(candlestick.c),
            };
            const calculations = processNewCandle(candle);
            console.log('Calcoli ricevuti:', calculations);

            if (calculations) {
                updateDashboard(calculations);
            }
        }
    };

    socket.onclose = () => {
        console.log(`WebSocket chiuso per ${symbol}`);
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// Cambio simbolo selezionato
function changeSymbol() {
    const select = document.getElementById('cryptoSelect');
    const newSymbol = select.value;
    if (!newSymbol) return;

    currentSymbol = newSymbol;

    loadHistoricalData(currentSymbol).then(() => {
        connectBinance(currentSymbol);
    });
}

// Aggiorna i valori in dashboard
function updateDashboard(calculations) {
    document.getElementById('linregValue').innerText = calculations.linreg.toFixed(2);
    document.getElementById('pearsonValue').innerText = calculations.pearson.toFixed(2);
    document.getElementById('bbValue').innerText = calculations.bb.toFixed(2);
    document.getElementById('stochValue').innerText = calculations.stoch.toFixed(2);
    document.getElementById('confluenceScore').innerText = calculations.score.toFixed(2);
    document.getElementById('lastUpdate').innerText = new Date().toLocaleTimeString();
}

// Refresh manuale (per ora solo log)
function refreshData() {
    console.log('Refresh manuale richiesto');
    // eventualmente potresti ricaricare dati o ricalcolare indicatori
}

let autoRefresh = false;
let refreshInterval = null;

function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    const btn = document.getElementById('autoRefreshBtn');
    if (autoRefresh) {
        refreshInterval = setInterval(() => {
            console.log('Auto refresh attivo');
            // Qui puoi decidere di ricaricare storico o ricalcolare indicatori se vuoi
        }, 60000);
        btn.innerText = '⏰ Auto Refresh: ON';
    } else {
        clearInterval(refreshInterval);
        btn.innerText = '⏰ Auto Refresh: OFF';
    }
}

// Esportiamo su window per poterli usare nell’HTML inline se serve
window.connectBinance = connectBinance;
window.changeSymbol = changeSymbol;
window.updateDashboard = updateDashboard;
window.refreshData = refreshData;
window.toggleAutoRefresh = toggleAutoRefresh;

// All’avvio carica storico e connette websocket
window.onload = () => {
    loadHistoricalData(currentSymbol).then(() => {
        connectBinance(currentSymbol);
    });

    // Se vuoi, aggiungi listener al select (meglio di onchange inline)
    const select = document.getElementById('cryptoSelect');
    if (select) {
        select.addEventListener('change', changeSymbol);
    }
};
