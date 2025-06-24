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

        if (candlestick.x) {
            const candle = {
                time: candlestick.t,
                open: parseFloat(candlestick.o),
                high: parseFloat(candlestick.h),
                low: parseFloat(candlestick.l),
                close: parseFloat(candlestick.c)
            };
            processNewCandle(candle);
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
