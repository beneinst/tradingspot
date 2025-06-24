import { processNewCandle } from './logica.js';

let socket = null;
let currentSymbol = 'btcusdt';

function connectBinance(symbol) {
    if (socket) socket.close();

    socket = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@kline_1m`);
    console.log('Connesso a Binance per', symbol);

    socket.onmessage = function (event) {
        const message = JSON.parse(event.data);
        const candlestick = message.k;

        // Se la candela è chiusa (x === true)
        if (candlestick.x) {
            const candle = {
                time: candlestick.t,
                open: parseFloat(candlestick.o),
                high: parseFloat(candlestick.h),
                low: parseFloat(candlestick.l),
                close: parseFloat(candlestick.c)
            };
            // Usa processNewCandle che restituisce i calcoli
            const calculations = processNewCandle(candle);

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
    connectBinance(currentSymbol);
}

function updateDashboard(calculations) {
    document.getElementById('linregValue').innerText = calculations.linreg.toFixed(2);
    document.getElementById('pearsonValue').innerText = calculations.pearson.toFixed(2);
    document.getElementById('bbValue').innerText = calculations.bb.toFixed(2);
    document.getElementById('stochValue').innerText = calculations.stoch.toFixed(2);
    document.getElementById('confluenceScore').innerText = calculations.score.toFixed(2);
    document.getElementById('lastUpdate').innerText = new Date().toLocaleTimeString();
}

window.connectBinance = connectBinance;
window.changeSymbol = changeSymbol;
window.updateDashboard = updateDashboard;

window.onload = function () {
    connectBinance(currentSymbol);
};
   let socket = null;
        let currentSymbol = 'btcusdt';

        function connectBinance(symbol) {
            if (socket) socket.close();

            socket = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@kline_1m`);
            console.log('Connesso a Binance per', symbol);

            socket.onmessage = function (event) {
                const message = JSON.parse(event.data);
                const candlestick = message.k;

                if (candlestick.x) { // Solo se la candela è chiusa
                    const candle = {
                        time: candlestick.t,
                        open: parseFloat(candlestick.o),
                        high: parseFloat(candlestick.h),
                        low: parseFloat(candlestick.l),
                        close: parseFloat(candlestick.c)
                    };

                    // Chiama la tua logica di calcolo
                    processNewCandle(candle); // Questa funzione la scrivi in logica.js
                }
            };

            socket.onclose = function () {
                console.log('Connessione chiusa per', symbol);
            };
        }

        function changeSymbol() {
            const select = document.getElementById('cryptoSelect');
            currentSymbol = select.value;
            connectBinance(currentSymbol);
        }

        // Funzione da chiamare per aggiornare la dashboard con nuovi dati
        function updateDashboard(calculations) {
            // Esempio: Aggiorno solo alcuni campi (puoi espandere)
            document.getElementById('linregValue').innerText = calculations.linreg.toFixed(2);
            document.getElementById('pearsonValue').innerText = calculations.pearson.toFixed(2);
            document.getElementById('bbValue').innerText = calculations.bb.toFixed(2);
            document.getElementById('stochValue').innerText = calculations.stoch.toFixed(2);

            // Aggiorna confluence score
            document.getElementById('confluenceScore').innerText = calculations.score.toFixed(2);
            document.getElementById('lastUpdate').innerText = new Date().toLocaleTimeString();

            // Aggiorna segnali e stati visivi se vuoi
        }

        // Connessione iniziale
        window.onload = function () {
            connectBinance(currentSymbol);
        };

        function refreshData() {
            console.log('Refresh manuale richiesto.');
            // Puoi implementare logiche per ricalcolo manuale se serve
        }

        let autoRefresh = false;
        let refreshInterval = null;

        function toggleAutoRefresh() {
            autoRefresh = !autoRefresh;
            const btn = document.getElementById('autoRefreshBtn');
            if (autoRefresh) {
                refreshInterval = setInterval(() => {
                    console.log('Auto refresh...');
                }, 60000);
                btn.innerText = '⏰ Auto Refresh: ON';
            } else {
                clearInterval(refreshInterval);
                btn.innerText = '⏰ Auto Refresh: OFF';
            }
        }
