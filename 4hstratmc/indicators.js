// indicators.js - Gestione Indicatori Tecnici
// Versione: 1.0

window.TechnicalIndicators = (function() {
    'use strict';

    let chartInstance = null;
    let candleSeriesInstance = null;
    let indicatorSeries = {};
    let isIndicatorsPanelOpen = false;

    // Configurazione indicatori disponibili
    const availableIndicators = {
        'sma': {
            name: 'Simple Moving Average',
            shortName: 'SMA',
            params: { period: 20 },
            color: '#2196F3'
        },
        'ema': {
            name: 'Exponential Moving Average', 
            shortName: 'EMA',
            params: { period: 20 },
            color: '#FF9800'
        },
        'rsi': {
            name: 'Relative Strength Index',
            shortName: 'RSI',
            params: { period: 14 },
            color: '#9C27B0'
        },
        'bollinger': {
            name: 'Bollinger Bands',
            shortName: 'BB',
            params: { period: 20, stdDev: 2 },
            color: '#4CAF50'
        }
    };

    // Funzione principale per aprire il pannello
    function openPanel(chart, candleSeries) {
        chartInstance = chart;
        candleSeriesInstance = candleSeries;
        
        if (isIndicatorsPanelOpen) {
            closePanel();
            return;
        }

        createIndicatorsPanel();
        isIndicatorsPanelOpen = true;
    }

    // Crea il pannello degli indicatori
    function createIndicatorsPanel() {
        // Rimuovi pannello esistente se presente
        const existingPanel = document.getElementById('indicators-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        const panel = document.createElement('div');
        panel.id = 'indicators-panel';
        panel.innerHTML = `
            <div class="indicators-header">
                <h3>📈 Indicatori Tecnici</h3>
                <button id="close-indicators" class="close-btn">✕</button>
            </div>
            <div class="indicators-content">
                <div class="indicator-section">
                    <h4>Medie Mobili</h4>
                    <div class="indicator-item">
                        <label>
                            <input type="checkbox" id="sma-toggle"> SMA (20)
                        </label>
                        <input type="number" id="sma-period" value="20" min="1" max="200">
                    </div>
                    <div class="indicator-item">
                        <label>
                            <input type="checkbox" id="ema-toggle"> EMA (20)
                        </label>
                        <input type="number" id="ema-period" value="20" min="1" max="200">
                    </div>
                </div>
                <div class="indicator-section">
                    <h4>Oscillatori</h4>
                    <div class="indicator-item">
                        <label>
                            <input type="checkbox" id="rsi-toggle"> RSI (14)
                        </label>
                        <input type="number" id="rsi-period" value="14" min="1" max="100">
                    </div>
                </div>
                <div class="indicator-section">
                    <h4>Bande e Canali</h4>
                    <div class="indicator-item">
                        <label>
                            <input type="checkbox" id="bollinger-toggle"> Bollinger Bands
                        </label>
                        <input type="number" id="bollinger-period" value="20" min="1" max="100">
                    </div>
                </div>
                <div class="indicator-actions">
                    <button id="apply-indicators" class="apply-btn">Applica Indicatori</button>
                    <button id="clear-indicators" class="clear-btn">Rimuovi Tutti</button>
                </div>
            </div>
        `;

        // Stili CSS per il pannello
        const style = document.createElement('style');
        style.textContent = `
            #indicators-panel {
                position: fixed;
                top: 80px;
                right: 20px;
                width: 320px;
                background: #23272f;
                border: 1px solid #444;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 1000;
                color: #fff;
                font-family: 'Trebuchet MS', sans-serif;
            }
            .indicators-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid #444;
                background: #2a2d35;
                border-radius: 8px 8px 0 0;
            }
            .indicators-header h3 {
                margin: 0;
                font-size: 1.1em;
            }
            .close-btn {
                background: none;
                border: none;
                color: #fff;
                font-size: 1.2em;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
            }
            .close-btn:hover {
                background: #ef5350;
            }
            .indicators-content {
                padding: 16px;
                max-height: 400px;
                overflow-y: auto;
            }
            .indicator-section {
                margin-bottom: 20px;
            }
            .indicator-section h4 {
                margin: 0 0 10px 0;
                font-size: 0.9em;
                color: #26a69a;
                border-bottom: 1px solid #444;
                padding-bottom: 5px;
            }
            .indicator-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                padding: 6px 0;
            }
            .indicator-item label {
                display: flex;
                align-items: center;
                cursor: pointer;
                flex: 1;
            }
            .indicator-item input[type="checkbox"] {
                margin-right: 8px;
            }
            .indicator-item input[type="number"] {
                width: 60px;
                padding: 4px 6px;
                background: #20232a;
                border: 1px solid #444;
                border-radius: 4px;
                color: #fff;
                font-size: 0.9em;
            }
            .indicator-actions {
                margin-top: 20px;
                display: flex;
                gap: 10px;
            }
            .apply-btn, .clear-btn {
                flex: 1;
                padding: 10px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                transition: all 0.2s ease;
            }
            .apply-btn {
                background: #26a69a;
                color: white;
            }
            .apply-btn:hover {
                background: #1e8e85;
            }
            .clear-btn {
                background: #ef5350;
                color: white;
            }
            .clear-btn:hover {
                background: #d32f2f;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);

        // Event listeners
        setupEventListeners();
    }

    // Configura gli event listeners
    function setupEventListeners() {
        document.getElementById('close-indicators').addEventListener('click', closePanel);
        document.getElementById('apply-indicators').addEventListener('click', applySelectedIndicators);
        document.getElementById('clear-indicators').addEventListener('click', clearAllIndicators);
    }

    // Chiude il pannello
    function closePanel() {
        const panel = document.getElementById('indicators-panel');
        if (panel) {
            panel.remove();
        }
        isIndicatorsPanelOpen = false;
    }

    // Applica gli indicatori selezionati
    function applySelectedIndicators() {
        console.log('Applicazione indicatori...');
        
        // Esempio: applica SMA se selezionato
        const smaToggle = document.getElementById('sma-toggle');
        if (smaToggle && smaToggle.checked) {
            const period = parseInt(document.getElementById('sma-period').value);
            addSMA(period);
        }

        // Esempio: applica EMA se selezionato
        const emaToggle = document.getElementById('ema-toggle');
        if (emaToggle && emaToggle.checked) {
            const period = parseInt(document.getElementById('ema-period').value);
            addEMA(period);
        }

        console.log('Indicatori applicati');
        closePanel();
    }

    // Rimuove tutti gli indicatori
    function clearAllIndicators() {
        Object.keys(indicatorSeries).forEach(key => {
            chartInstance.removeSeries(indicatorSeries[key]);
        });
        indicatorSeries = {};
        console.log('Tutti gli indicatori rimossi');
    }

    // Funzioni per calcolare e aggiungere indicatori specifici
    function addSMA(period) {
        // Rimuovi SMA esistente
        if (indicatorSeries.sma) {
            chartInstance.removeSeries(indicatorSeries.sma);
        }

        // Aggiungi nuova serie SMA
        indicatorSeries.sma = chartInstance.addSeries(LightweightCharts.LineSeries, {
            color: availableIndicators.sma.color,
            lineWidth: 2,
            title: `SMA(${period})`
        });

        // Calcola SMA (implementazione semplificata)
        // In un'implementazione reale, dovresti calcolare la SMA dai dati delle candele
        console.log(`SMA(${period}) aggiunto`);
    }

    function addEMA(period) {
        // Rimuovi EMA esistente
        if (indicatorSeries.ema) {
            chartInstance.removeSeries(indicatorSeries.ema);
        }

        // Aggiungi nuova serie EMA
        indicatorSeries.ema = chartInstance.addSeries(LightweightCharts.LineSeries, {
            color: availableIndicators.ema.color,
            lineWidth: 2,
            title: `EMA(${period})`
        });

        console.log(`EMA(${period}) aggiunto`);
    }

    // Funzioni di calcolo indicatori (da implementare)
    function calculateSMA(data, period) {
        // Implementazione calcolo SMA
        const smaData = [];
        // ... logica di calcolo
        return smaData;
    }

    function calculateEMA(data, period) {
        // Implementazione calcolo EMA
        const emaData = [];
        // ... logica di calcolo
        return emaData;
    }

    // API pubblica
    return {
        openPanel: openPanel,
        closePanel: closePanel,
        addIndicator: function(type, params) {
            // Funzione per aggiungere indicatori programmaticamente
            console.log(`Aggiungendo indicatore: ${type}`, params);
        },
        removeIndicator: function(type) {
            // Funzione per rimuovere indicatori specifici
            if (indicatorSeries[type]) {
                chartInstance.removeSeries(indicatorSeries[type]);
                delete indicatorSeries[type];
            }
        },
        getAvailableIndicators: function() {
            return availableIndicators;
        }
    };
})();

console.log('📈 Modulo Indicatori Tecnici caricato');