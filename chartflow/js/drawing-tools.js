// drawing-tools.js - Strumenti di Disegno per Trading Charts
// Versione: 1.0

window.DrawingTools = (function() {
    'use strict';

    let chartInstance = null;
    let candleSeriesInstance = null;
    let currentTool = 'cursor';
    let isDrawingToolsPanelOpen = false;
    let drawingObjects = [];
    let isDrawing = false;
    let currentDrawing = null;

    // Strumenti di disegno disponibili
    const drawingTools = {
        'cursor': {
            name: 'Cursore',
            icon: '↖️',
            description: 'Modalità selezione'
        },
        'horizontal-line': {
            name: 'Linea Orizzontale',
            icon: '━',
            description: 'Linea di prezzo orizzontale'
        },
        'vertical-line': {
            name: 'Linea Verticale', 
            icon: '┃',
            description: 'Linea temporale verticale'
        },
        'trend-line': {
            name: 'Linea di Tendenza',
            icon: '📈',
            description: 'Linea di tendenza diagonale'
        },
        'rectangle': {
            name: 'Rettangolo',
            icon: '▭',
            description: 'Area rettangolare'
        },
        'fibonacci': {
            name: 'Ritracciamenti Fibonacci',
            icon: '🌀',
            description: 'Livelli di Fibonacci'
        },
        'text': {
            name: 'Testo',
            icon: '📝',
            description: 'Annotazione testuale'
        },
        'arrow': {
            name: 'Freccia',
            icon: '➡️',
            description: 'Freccia direzionale'
        }
    };

    // Colori disponibili per il disegno
    const drawingColors = [
        '#26a69a', '#ef5350', '#2196F3', '#FF9800', 
        '#9C27B0', '#4CAF50', '#FFC107', '#E91E63'
    ];

    let selectedColor = drawingColors[0];
    let lineWidth = 2;

    // Funzione principale per aprire il pannello
    function openPanel(chart, candleSeries) {
        chartInstance = chart;
        candleSeriesInstance = candleSeries;
        
        if (isDrawingToolsPanelOpen) {
            closePanel();
            return;
        }

        createDrawingToolsPanel();
        setupChartInteractions();
        isDrawingToolsPanelOpen = true;
    }

    // Crea il pannello degli strumenti di disegno
    function createDrawingToolsPanel() {
        // Rimuovi pannello esistente se presente
        const existingPanel = document.getElementById('drawing-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        const panel = document.createElement('div');
        panel.id = 'drawing-panel';
        
        // Genera HTML per gli strumenti
        const toolsHTML = Object.keys(drawingTools).map(toolKey => `
            <div class="drawing-tool-item ${toolKey === currentTool ? 'active' : ''}" 
                 data-tool="${toolKey}" title="${drawingTools[toolKey].description}">
                <span class="tool-icon">${drawingTools[toolKey].icon}</span>
                <span class="tool-name">${drawingTools[toolKey].name}</span>
            </div>
        `).join('');

        // Genera HTML per i colori
        const colorsHTML = drawingColors.map(color => `
            <div class="color-option ${color === selectedColor ? 'active' : ''}" 
                 data-color="${color}" 
                 style="background-color: ${color}"></div>
        `).join('');

        panel.innerHTML = `
            <div class="drawing-header">
                <h3>✏️ Strumenti di Disegno</h3>
                <button id="close-drawing" class="close-btn">✕</button>
            </div>
            <div class="drawing-content">
                <div class="tools-section">
                    <h4>Strumenti</h4>
                    <div class="drawing-tools-grid">
                        ${toolsHTML}
                    </div>
                </div>
                
                <div class="style-section">
                    <h4>Stile</h4>
                    <div class="style-controls">
                        <div class="color-picker">
                            <label>Colore:</label>
                            <div class="colors-grid">
                                ${colorsHTML}
                            </div>
                        </div>
                        <div class="line-width-control">
                            <label>Spessore:</label>
                            <input type="range" id="line-width" min="1" max="5" value="${lineWidth}">
                            <span id="line-width-value">${lineWidth}px</span>
                        </div>
                    </div>
                </div>

                <div class="objects-section">
                    <h4>Oggetti Disegnati (${drawingObjects.length})</h4>
                    <div class="objects-list" id="objects-list">
                        ${drawingObjects.length === 0 ? '<p class="no-objects">Nessun oggetto disegnato</p>' : ''}
                    </div>
                </div>

                <div class="drawing-actions">
                    <button id="clear-all-drawings" class="clear-btn">🗑️ Cancella Tutto</button>
                    <button id="save-drawings" class="save-btn">💾 Salva Layout</button>
                </div>
            </div>
        `;

        // Stili CSS per il pannello
        addDrawingPanelStyles();
        document.body.appendChild(panel);

        // Event listeners
        setupDrawingEventListeners();
    }

    // Aggiunge gli stili CSS
    function addDrawingPanelStyles() {
        const style = document.createElement('style');
        style.id = 'drawing-panel-styles';
        style.textContent = `
            #drawing-panel {
                position: fixed;
                top: 80px;
                left: 20px;
                width: 280px;
                background: #23272f;
                border: 1px solid #444;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 1000;
                color: #fff;
                font-family: 'Trebuchet MS', sans-serif;
                max-height: calc(100vh - 100px);
                overflow-y: auto;
            }
            .drawing-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid #444;
                background: #2a2d35;
                border-radius: 8px 8px 0 0;
                position: sticky;
                top: 0;
                z-index: 1;
            }
            .drawing-header h3 {
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
            .drawing-content {
                padding: 16px;
            }
            .tools-section, .style-section, .objects-section {
                margin-bottom: 20px;
            }
            .tools-section h4, .style-section h4, .objects-section h4 {
                margin: 0 0 10px 0;
                font-size: 0.9em;
                color: #26a69a;
                border-bottom: 1px solid #444;
                padding-bottom: 5px;
            }
            .drawing-tools-grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: 4px;
            }
            .drawing-tool-item {
                display: flex;
                align-items: center;
                padding: 8px 12px;
                background: #20232a;
                border: 1px solid #444;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .drawing-tool-item:hover {
                border-color: #26a69a;
                background: #26a69a20;
            }
            .drawing-tool-item.active {
                border-color: #26a69a;
                background: #26a69a;
                color: #000;
            }
            .tool-icon {
                margin-right: 8px;
                font-size: 1.1em;
                width: 20px;
                text-align: center;
            }
            .tool-name {
                font-size: 0.9em;
            }
            .colors-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 6px;
                margin-top: 8px;
            }
            .color-option {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                cursor: pointer;
                border: 2px solid transparent;
                transition: all 0.2s ease;
            }
            .color-option:hover {
                transform: scale(1.1);
            }
            .color-option.active {
                border-color: #fff;
                box-shadow: 0 0 0 2px #26a69a;
            }
            .line-width-control {
                margin-top: 12px;
            }
            .line-width-control label {
                display: block;
                margin-bottom: 6px;
                font-size: 0.9em;
            }
            .line-width-control input {
                width: 100%;
                margin-right: 8px;
            }
            #line-width-value {
                font-size: 0.85em;
                color: #26a69a;
            }
            .objects-list {
                max-height: 120px;
                overflow-y: auto;
                background: #20232a;
                border-radius: 4px;
                padding: 8px;
            }
            .no-objects {
                text-align: center;
                color: #666;
                font-size: 0.85em;
                margin: 0;
            }
            .drawing-actions {
                display: flex;
                gap: 8px;
                margin-top: 16px;
            }
            .clear-btn, .save-btn {
                flex: 1;
                padding: 8px 12px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                font-size: 0.85em;
                transition: all 0.2s ease;
            }
            .clear-btn {
                background: #ef5350;
                color: white;
            }
            .clear-btn:hover {
                background: #d32f2f;
            }
            .save-btn {
                background: #2196F3;
                color: white;
            }
            .save-btn:hover {
                background: #1976D2;
            }
            .current-tool-indicator {
                position: fixed;
                top: 50%;
                right: 20px;
                background: rgba(38, 166, 154, 0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 0.85em;
                pointer-events: none;
                z-index: 999;
                display: none;
            }
        `;
        document.head.appendChild(style);
    }

    // Configura gli event listeners del pannello
    function setupDrawingEventListeners() {
        // Chiusura pannello
        document.getElementById('close-drawing').addEventListener('click', closePanel);

        // Selezione strumenti
        document.querySelectorAll('.drawing-tool-item').forEach(item => {
            item.addEventListener('click', function() {
                const tool = this.dataset.tool;
                selectTool(tool);
            });
        });

        // Selezione colori
        document.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', function() {
                const color = this.dataset.color;
                selectColor(color);
            });
        });

        // Controllo spessore linea
        document.getElementById('line-width').addEventListener('input', function() {
            lineWidth = parseInt(this.value);
            document.getElementById('line-width-value').textContent = lineWidth + 'px';
        });

        // Azioni
        document.getElementById('clear-all-drawings').addEventListener('click', clearAllDrawings);
        document.getElementById('save-drawings').addEventListener('click', saveDrawings);
    }

    // Configura le interazioni con il grafico
    function setupChartInteractions() {
        // Per ora implementiamo le linee orizzontali di prezzo
        chartInstance.subscribeClick(handleChartClick);
        
        // Aggiungi indicatore dello strumento corrente
        showCurrentToolIndicator();
    }

    // Gestisce i click sul grafico
    function handleChartClick(param) {
        if (!param.point || currentTool === 'cursor') return;

        const price = candleSeriesInstance.coordinateToPrice(param.point.y);
        const time = param.time;

        switch (currentTool) {
            case 'horizontal-line':
                addHorizontalLine(price);
                break;
            case 'vertical-line':
                addVerticalLine(time);
                break;
            case 'text':
                addTextAnnotation(time, price);
                break;
            default:
                console.log(`Strumento ${currentTool} non ancora implementato`);
        }
    }

    // Aggiunge una linea orizzontale di prezzo
    function addHorizontalLine(price) {
        const priceLine = {
            price: price,
            color: selectedColor,
            lineWidth: lineWidth,
            lineStyle: LightweightCharts.LineStyle.Solid,
            axisLabelVisible: true,
            title: `Prezzo: ${price.toFixed(4)}`
        };

        candleSeriesInstance.createPriceLine(priceLine);
        
        drawingObjects.push({
            id: Date.now(),
            type: 'horizontal-line',
            price: price,
            color: selectedColor,
            lineWidth: lineWidth
        });

        updateObjectsList();
        console.log(`Linea orizzontale aggiunta a ${price.toFixed(4)}`);
    }

    // Aggiunge una linea verticale temporale
    function addVerticalLine(time) {
        // Per le linee verticali, utilizziamo una serie di linee
        console.log(`Linea verticale aggiunta al tempo ${time}`);
        
        drawingObjects.push({
            id: Date.now(),
            type: 'vertical-line',
            time: time,
            color: selectedColor,
            lineWidth: lineWidth
        });

        updateObjectsList();
    }

    // Aggiunge un'annotazione testuale
    function addTextAnnotation(time, price) {
        const text = prompt('Inserisci il testo:');
        if (!text) return;

        console.log(`Testo "${text}" aggiunto a ${time}, ${price.toFixed(4)}`);
        
        drawingObjects.push({
            id: Date.now(),
            type: 'text',
            time: time,
            price: price,
            text: text,
            color: selectedColor
        });

        updateObjectsList();
    }

    // Seleziona uno strumento
    function selectTool(tool) {
        currentTool = tool;
        
        // Aggiorna UI
        document.querySelectorAll('.drawing-tool-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-tool="${tool}"]`).classList.add('active');

        // Aggiorna cursore del grafico
        updateChartCursor();
        showCurrentToolIndicator();
        
        console.log(`Strumento selezionato: ${drawingTools[tool].name}`);
    }

    // Seleziona un colore
    function selectColor(color) {
        selectedColor = color;
        
        // Aggiorna UI
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.remove('active');
        });
        document.querySelector(`[data-color="${color}"]`).classList.add('active');
        
        console.log(`Colore selezionato: ${color}`);
    }

    // Aggiorna il cursore del grafico
    function updateChartCursor() {
        const chartContainer = document.getElementById('chart');
        if (currentTool === 'cursor') {
            chartContainer.style.cursor = 'default';
        } else {
            chartContainer.style.cursor = 'crosshair';
        }
    }

    // Mostra l'indicatore dello strumento corrente
    function showCurrentToolIndicator() {
        let indicator = document.querySelector('.current-tool-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'current-tool-indicator';
            document.body.appendChild(indicator);
        }

        if (currentTool !== 'cursor') {
            indicator.textContent = `${drawingTools[currentTool].icon} ${drawingTools[currentTool].name}`;
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    }

    // Aggiorna la lista degli oggetti disegnati
    function updateObjectsList() {
        const objectsList = document.getElementById('objects-list');
        const objectsSection = document.querySelector('.objects-section h4');
        
        objectsSection.textContent = `Oggetti Disegnati (${drawingObjects.length})`;
        
        if (drawingObjects.length === 0) {
            objectsList.innerHTML = '<p class="no-objects">Nessun oggetto disegnato</p>';
        } else {
            objectsList.innerHTML = drawingObjects.map(obj => `
                <div class="object-item">
                    ${drawingTools[obj.type].icon} ${drawingTools[obj.type].name}
                    <button onclick="window.DrawingTools.removeObject(${obj.id})">🗑️</button>
                </div>
            `).join('');
        }
    }

    // Rimuove tutti i disegni
    function clearAllDrawings() {
        if (drawingObjects.length === 0) return;
        
        if (confirm('Sei sicuro di voler cancellare tutti i disegni?')) {
            // Rimuovi tutte le price lines
            drawingObjects.forEach(obj => {
                if (obj.type === 'horizontal-line') {
                    // Rimuovere price line specifica richiede riferimento
                }
            });
            
            drawingObjects = [];
            updateObjectsList();
            console.log('Tutti i disegni sono stati cancellati');
        }
    }

    // Salva i disegni
    function saveDrawings() {
        const drawingsData = JSON.stringify(drawingObjects);
        localStorage.setItem('tradingview_drawings', drawingsData);
        
        // Feedback visivo
        const saveBtn = document.getElementById('save-drawings');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '✅ Salvato!';
        setTimeout(() => {
            saveBtn.textContent = originalText;
        }, 2000);
        
        console.log('Layout dei disegni salvato');
    }

    // Carica i disegni salvati
    function loadDrawings() {
        const saved = localStorage.getItem('tradingview_drawings');
        if (saved) {
            try {
                drawingObjects = JSON.parse(saved);
                // Ricrea i disegni sul grafico
                drawingObjects.forEach(obj => {
                    if (obj.type === 'horizontal-line') {
                        addHorizontalLine(obj.price);
                    }
                });
                console.log('Layout dei disegni caricato');
            } catch (e) {
                console.error('Errore nel caricamento dei disegni:', e);
            }
        }
    }

    // Chiude il pannello
    function closePanel() {
        const panel = document.getElementById('drawing-panel');
        if (panel) {
            panel.remove();
        }
        
        const indicator = document.querySelector('.current-tool-indicator');
        if (indicator) {
            indicator.remove();
        }

        const styles = document.getElementById('drawing-panel-styles');
        if (styles) {
            styles.remove();
        }

        // Reset cursore
        const chartContainer = document.getElementById('chart');
        if (chartContainer) {
            chartContainer.style.cursor = 'default';
        }

        currentTool = 'cursor';
        isDrawingToolsPanelOpen = false;
    }

    // API pubblica
    return {
        openPanel: openPanel,
        closePanel: closePanel,
        selectTool: selectTool,
        addHorizontalLine: addHorizontalLine,
        clearAllDrawings: clearAllDrawings,
        removeObject: function(id) {
            drawingObjects = drawingObjects.filter(obj => obj.id !== id);
            updateObjectsList();
        },
        getDrawingObjects: function() {
            return drawingObjects;
        },
        loadDrawings: loadDrawings
    };
})();

console.log('✏️ Modulo Strumenti di Disegno caricato');