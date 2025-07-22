 // Sistema trade migliorato - inserimento per importo investito

// Cache per i prezzi delle crypto
let priceCache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti

// Gestione trade
let trades = [];
let editingTradeId = null;

// Mappa dei simboli crypto ai loro ID CoinGecko
const coinGeckoIdMap = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'BNB': 'binancecoin',
    'ADA': 'cardano',
    'DOT': 'polkadot',
    'LINK': 'chainlink',
    'XRP': 'ripple',
    'LTC': 'litecoin',
    'BCH': 'bitcoin-cash',
    'XLM': 'stellar',
    'UNI': 'uniswap',
    'AAVE': 'aave',
    'SUSHI': 'sushi',
    'COMP': 'compound-governance-token',
    'MKR': 'maker',
    'SNX': 'havven',
    'YFI': 'yearn-finance',
    'USDC': 'usd-coin',
    'USDT': 'tether',
    'DAI': 'dai',
    'BUSD': 'binance-usd',
    'MATIC': 'matic-network',
    'AVAX': 'avalanche-2',
    'SOL': 'solana',
    'ATOM': 'cosmos',
    'LUNA': 'terra-luna',
    'FTT': 'ftx-token',
    'ALGO': 'algorand',
    'VET': 'vechain',
    'ICP': 'internet-computer',
    'TRX': 'tron',
    'FIL': 'filecoin',
    'ETC': 'ethereum-classic',
    'XMR': 'monero',
    'THETA': 'theta-token',
    'CAKE': 'pancakeswap-token',
    'FET': 'artificial-superintelligence-alliance',
    'NEAR': 'near'
};

// Ottieni prezzo da CoinGecko
async function getPriceFromCoinGecko(symbol) {
    try {
        const cacheKey = symbol.toLowerCase();
        const now = Date.now();
        
        // Controlla cache
        if (priceCache[cacheKey] && (now - priceCache[cacheKey].timestamp) < CACHE_DURATION) {
            return priceCache[cacheKey].price;
        }

        // Prima prova con la mappa dei simboli
        const coinId = coinGeckoIdMap[symbol.toUpperCase()];
        if (coinId) {
            const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
            const data = await response.json();
            
            if (data[coinId]?.usd) {
                const price = data[coinId].usd;
                priceCache[cacheKey] = { price, timestamp: now };
                return price;
            }
        }

        // Fallback: cerca per symbol
        const searchResponse = await fetch(`https://api.coingecko.com/api/v3/search?query=${symbol}`);
        const searchData = await searchResponse.json();
        
        if (searchData.coins && searchData.coins.length > 0) {
            const coinId = searchData.coins[0].id;
            const priceResponse = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
            const priceData = await priceResponse.json();
            
            if (priceData[coinId]?.usd) {
                const price = priceData[coinId].usd;
                priceCache[cacheKey] = { price, timestamp: now };
                return price;
            }
        }
        
        throw new Error(`Prezzo non trovato per ${symbol}`);
    } catch (error) {
        console.error(`Errore nel recupero prezzo per ${symbol}:`, error);
        return null;
    }
}

// FUNZIONE PRINCIPALE PER LA STAMPA DI TUTTI I TRADE
async function stampaTuttiTrade() {
    if (trades.length === 0) {
        alert('Nessun trade da stampare');
        return;
    }
    
    let htmlContent = `
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tutti i Trade - Crypto Trading Report</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                margin: 20px; 
                line-height: 1.4;
                color: #333;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 2px solid #333;
            }
            .trade-card {
                margin-bottom: 40px;
                page-break-inside: avoid;
                border: 1px solid #ddd;
                padding: 20px;
                border-radius: 8px;
            }
            .trade-title {
                background-color: #f5f5f5;
                padding: 15px;
                margin: -20px -20px 20px -20px;
                border-radius: 8px 8px 0 0;
                font-size: 1.2em;
                font-weight: bold;
            }
            .summary-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin-bottom: 20px;
                padding: 15px;
                background-color: #fafafa;
                border-radius: 5px;
            }
            .summary-item {
                display: flex;
                flex-direction: column;
            }
            .label {
                font-weight: bold;
                color: #666;
                font-size: 0.9em;
            }
            .value {
                font-size: 1.1em;
                margin-top: 5px;
            }
            .positive { color: #22c55e; font-weight: bold; }
            .negative { color: #ef4444; font-weight: bold; }
            .neutral { color: #6b7280; }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 10px;
                text-align: left;
            }
            th {
                background-color: #f9f9f9;
                font-weight: bold;
            }
            .footer {
                margin-top: 30px;
                text-align: center;
                font-size: 0.9em;
                color: #666;
                border-top: 1px solid #ddd;
                padding-top: 20px;
            }
            .portfolio-summary {
                background-color: #f0f8ff;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 30px;
                border-left: 4px solid #007bff;
            }
            @media print {
                body { margin: 0; }
                .trade-card { page-break-inside: avoid; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>📊 Report Completo Crypto Trading</h1>
            <p>Report generato il ${new Date().toLocaleString('it-IT')}</p>
        </div>
    `;

    // Calcola riepilogo portfolio
    let totalInvestmentPortfolio = 0;
    let totalCurrentValuePortfolio = 0;
    
    for (let index = 0; index < trades.length; index++) {
        const trade = trades[index];
        const stats = calcolaStatisticheTrade(trade.entries);
        const { totalInvestment, totalQuantity, avgPrice } = stats;
        
        const currentPrice = await getPriceFromCoinGecko(trade.symbol);
        const currentValue = currentPrice ? totalQuantity * currentPrice : 0;
        
        totalInvestmentPortfolio += totalInvestment;
        totalCurrentValuePortfolio += currentValue;
        
        const pnl = currentValue - totalInvestment;
        const pnlPercent = totalInvestment > 0 ? (pnl / totalInvestment) * 100 : 0;
        const pnlClass = pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : 'neutral';

        // Genera tabella entries
        let entriesHtml = '';
        trade.entries.forEach((entry, entryIndex) => {
            entriesHtml += `
                <tr>
                    <td>${entryIndex + 1}</td>
                    <td>${entry.quantity.toFixed(8)}</td>
                    <td>$${entry.priceAtPurchase.toFixed(2)}</td>
                    <td>$${entry.investedAmount.toFixed(2)}</td>
                    <td>${new Date(entry.timestamp).toLocaleDateString('it-IT')}</td>
                </tr>
            `;
        });

        htmlContent += `
        <div class="trade-card">
            <div class="trade-title">
                🪙 ${trade.symbol.toUpperCase()} | Trade #${String(trades.length - index).padStart(2, '0')}
            </div>
            
            <h3>Riepilogo Trade</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="label">Quantità Totale</div>
                    <div class="value">${totalQuantity.toFixed(8)} ${trade.symbol.toUpperCase()}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Prezzo Medio di Acquisto</div>
                    <div class="value">$${avgPrice.toFixed(2)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Investimento Totale</div>
                    <div class="value">$${totalInvestment.toFixed(2)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Prezzo Attuale</div>
                    <div class="value">${currentPrice ? '$' + currentPrice.toFixed(2) : 'N/A'}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Valore Attuale</div>
                    <div class="value">$${currentValue.toFixed(2)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Profitto/Perdita (P&L)</div>
                    <div class="value ${pnlClass}">$${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)</div>
                </div>
            </div>

            <h4>Storia Entry</h4>
            <table>
                <thead>
                    <tr>
                        <th>Entry #</th>
                        <th>Quantità</th>
                        <th>Prezzo di Acquisto</th>
                        <th>Importo Investito</th>
                        <th>Data</th>
                    </tr>
                </thead>
                <tbody>${entriesHtml}</tbody>
            </table>
            
            <p><strong>Creato il:</strong> ${new Date(trade.createdAt).toLocaleDateString('it-IT')}</p>
            <p><strong>Ultimo aggiornamento:</strong> ${new Date(trade.updatedAt).toLocaleDateString('it-IT')}</p>
        </div>
        `;
    }

    // Aggiungi riepilogo portfolio finale
    const portfolioPnl = totalCurrentValuePortfolio - totalInvestmentPortfolio;
    const portfolioPnlPercent = totalInvestmentPortfolio > 0 ? (portfolioPnl / totalInvestmentPortfolio) * 100 : 0;
    const portfolioPnlClass = portfolioPnl > 0 ? 'positive' : portfolioPnl < 0 ? 'negative' : 'neutral';

    htmlContent += `
        <div class="portfolio-summary">
            <h2>💼 Riepilogo Portfolio Totale</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="label">Numero Trade Attivi</div>
                    <div class="value">${trades.length}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Investimento Totale Portfolio</div>
                    <div class="value">$${totalInvestmentPortfolio.toFixed(2)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Valore Attuale Portfolio</div>
                    <div class="value">$${totalCurrentValuePortfolio.toFixed(2)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">P&L Portfolio Totale</div>
                    <div class="value ${portfolioPnlClass}">$${portfolioPnl.toFixed(2)} (${portfolioPnlPercent.toFixed(2)}%)</div>
                </div>
            </div>
        </div>
    `;

    htmlContent += `
        <div class="footer">
            <p>📈 Report Crypto Trading Completo - Generato automaticamente</p>
            <p>Dati aggiornati al ${new Date().toLocaleString('it-IT')}</p>
        </div>
    </body>
    </html>
    `;

    // Apri in una nuova finestra per la stampa
   // ✅ SOLO download automatico .html via Blob
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `report-trading-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);

}

// Esponi la funzione globalmente per il pulsante
window.stampaTuttiTrade = stampaTuttiTrade;

// Calcola importo medio ponderato e quantità totale
function calcolaStatisticheTrade(entries) {
    let totalInvestment = 0;
    let totalQuantity = 0;
    
    entries.forEach(entry => {
        totalInvestment += entry.investedAmount;
        totalQuantity += entry.quantity;
    });
    
    const avgPrice = totalQuantity > 0 ? totalInvestment / totalQuantity : 0;
    
    return {
        totalInvestment,
        totalQuantity,
        avgPrice
    };
}

// Salva trade
function saveTrades() {
    localStorage.setItem('singleTrades', JSON.stringify(trades));
}

// Carica trade
function loadTrades() {
    const saved = localStorage.getItem('singleTrades');
    if (saved) {
        const rawTrades = JSON.parse(saved);
        trades = validateTrades(rawTrades);
        saveTrades();
    }
}

// Render trade (RIMOSSO IL PULSANTE STAMPA INDIVIDUALE)
async function renderTrades() {
    const container = document.getElementById('trades-container');
    container.innerHTML = '<div class="loading">Caricamento trade...</div>';
    
    if (trades.length === 0) {
        container.innerHTML = '<div class="empty-state">Nessun trade presente.</div>';
        return;
    }

    let html = '';
    
    for (let index = 0; index < trades.length; index++) {
        const trade = trades[index];
        const stats = calcolaStatisticheTrade(trade.entries);
        const { totalInvestment, totalQuantity, avgPrice } = stats;
        
        const currentPrice = await getPriceFromCoinGecko(trade.symbol);
        const currentValue = currentPrice ? totalQuantity * currentPrice : 0;
        const pnl = currentValue - totalInvestment;
        const pnlPercent = totalInvestment > 0 ? (pnl / totalInvestment) * 100 : 0;
        
        const pnlClass = pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : 'neutral';

        // Genera tabella entries
        let entriesHtml = '';
        trade.entries.forEach((entry, index) => {
            entriesHtml += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${entry.quantity.toFixed(8)}</td>
                    <td>$${entry.priceAtPurchase.toFixed(2)}</td>
                    <td>$${entry.investedAmount.toFixed(2)}</td>
                    <td>${new Date(entry.timestamp).toLocaleDateString('it-IT')}</td>
                </tr>
            `;
        });

        html += `
            <div class="note">
                <h3>🪙 ${trade.symbol.toUpperCase()} | Trade #${String(trades.length - index).padStart(2, '0')}</h3>
                
                <div class="trade-summary">
                    <h3>Riepilogo Trade</h3>
                    <div class="summary-grid">
                        <div class="summary-item">
                            <div class="label">Quantità Totale</div>
                            <div class="value">${totalQuantity.toFixed(8)} ${trade.symbol.toUpperCase()}</div>
                        </div>
                        <div class="summary-item">
                            <div class="label">Prezzo Medio di Acquisto</div>
                            <div class="value">$${avgPrice.toFixed(2)}</div>
                        </div>
                        <div class="summary-item">
                            <div class="label">Investimento Totale</div>
                            <div class="value">$${totalInvestment.toFixed(2)}</div>
                        </div>
                        <div class="summary-item">
                            <div class="label">Prezzo Attuale</div>
                            <div class="value current-price">$${currentPrice ? currentPrice.toFixed(2) : 'N/A'}</div>
                        </div>
                        <div class="summary-item">
                            <div class="label">Valore Attuale</div>
                            <div class="value">$${currentValue.toFixed(2)}</div>
                        </div>
                        <div class="summary-item">
                            <div class="label">Profitto/Perdita (P&L)</div>
                            <div class="value ${pnlClass}">$${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)</div>
                        </div>
                    </div>
                </div>

                <h4>Storia Entry</h4><p></p>
                <table>
                    <thead>
                        <tr>
                            <th>Entry #</th>
                            <th>Quantità</th>
                            <th>Prezzo di Acquisto</th>
                            <th>Importo Investito</th>
                            <th>Data</th>
                        </tr>
                    </thead>
                    <tbody>${entriesHtml}</tbody>
                </table>
                
                <div class="last-update">
                    Ultimo aggiornamento: ${new Date().toLocaleString('it-IT')}
                </div>
                
                <small>Creato il ${new Date(trade.createdAt).toLocaleDateString('it-IT')}</small>
                
                <div class="note-actions">
                    <button class="btn-edit" onclick="addEntryToTrade(${trade.id})">Aggiungi Entry</button>
                    <button class="btn-danger" onclick="deleteTrade(${trade.id})">Elimina Trade</button>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// Aggiungi entry al trade esistente
window.addEntryToTrade = function(tradeId) {
    const trade = trades.find(t => t.id === tradeId);
    if (trade) {
        document.getElementById('crypto-symbol').value = trade.symbol;
        document.getElementById('crypto-symbol').readOnly = true;
        document.getElementById('edit-trade-id').value = tradeId;
        window.scrollTo({top: 0, behavior: 'smooth'});
    }
};

// Elimina trade
window.deleteTrade = function(id) {
    if (confirm('Eliminare questo trade?')) {
        trades = trades.filter(t => t.id !== id);
        saveTrades();
        renderTrades();
    }
};

// Gestione form - MODIFICATA PER PERMETTERE TRADE MULTIPLI
document.getElementById('trade-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const symbol = document.getElementById('crypto-symbol').value.trim().toUpperCase();
    const quantity = parseFloat(document.getElementById('trade-quantity').value);
    const investedAmount = parseFloat(document.getElementById('invested-amount').value);
    const editId = document.getElementById('edit-trade-id').value;
    
    if (!symbol || !quantity || !investedAmount) {
        alert('Compila tutti i campi');
        return;
    }
    
    // Ottieni prezzo attuale per calcolare il prezzo di acquisto
    const currentPrice = await getPriceFromCoinGecko(symbol);
    if (!currentPrice) {
        alert('Impossibile ottenere il prezzo per ' + symbol);
        return;
    }
    
    const priceAtPurchase = investedAmount / quantity;
    
    const newEntry = {
        quantity: quantity,
        investedAmount: investedAmount,
        priceAtPurchase: priceAtPurchase,
        timestamp: new Date().toISOString()
    };
    
    if (editId) {
        // MODIFICA: Aggiungi entry SOLO a trade esistente quando si usa il pulsante "Aggiungi Entry"
        const tradeIndex = trades.findIndex(t => t.id === parseInt(editId));
        if (tradeIndex !== -1 && Array.isArray(trades[tradeIndex].entries)) {
            trades[tradeIndex].entries.push(newEntry);
            trades[tradeIndex].updatedAt = new Date().toISOString();
        } else {
            alert("Trade non trovato o struttura corrotta, impossibile aggiungere entry.");
            return;
        }
    } else {
        // MODIFICA: Crea SEMPRE un nuovo trade quando non si è in modalità modifica
        // Non cerca più trade esistenti con lo stesso simbolo
        trades.unshift({
            id: Date.now(),
            symbol: symbol,
            entries: [newEntry],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }
    
    saveTrades();
    renderTrades();
    this.reset();
    document.getElementById('crypto-symbol').readOnly = false;
    document.getElementById('edit-trade-id').value = '';
});

function validateTrades(tradesArray) {
    if (!Array.isArray(tradesArray)) return [];
    return tradesArray.map(trade => ({
        id: typeof trade.id === "number" ? trade.id : Date.now(),
        symbol: typeof trade.symbol === "string" ? trade.symbol : "",
        entries: Array.isArray(trade.entries) ? trade.entries.map(entry => ({
            quantity: typeof entry.quantity === "number" ? entry.quantity : 0,
            investedAmount: typeof entry.investedAmount === "number" ? entry.investedAmount : 0,
            priceAtPurchase: typeof entry.priceAtPurchase === "number" ? entry.priceAtPurchase : 0,
            timestamp: typeof entry.timestamp === "string" ? entry.timestamp : new Date().toISOString()
        })) : [],
        createdAt: typeof trade.createdAt === "string" ? trade.createdAt : new Date().toISOString(),
        updatedAt: typeof trade.updatedAt === "string" ? trade.updatedAt : new Date().toISOString()
    }));
}

// Backup functions
function scaricaDati() {
    const data = JSON.stringify(trades, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `trades-backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function caricaDati() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedTrades = JSON.parse(e.target.result);
                if (Array.isArray(importedTrades)) {
                    trades = importedTrades;
                    saveTrades();
                    renderTrades();
                    alert('Dati importati con successo!');
                    fileInput.value = '';
                } else {
                    alert('Il file non contiene un formato di dati valido.');
                }
            } catch (error) {
                alert('Errore durante l\'importazione dei dati: ' + error.message);
            }
        };
        reader.readAsText(file);
    } else {
        alert('Seleziona un file da importare.');
    }
}

// Inizializzazione
document.addEventListener('DOMContentLoaded', function() {
    loadTrades();
    renderTrades();
});