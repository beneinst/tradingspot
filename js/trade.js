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

// FUNZIONE PRINCIPALE PER LA STAMPA DI TUTTI I TRADE - ADATTATA PER TRADE12
async function stampaTuttiTrade() {
    // Carica i dati più recenti dal cloud se disponibili
    if (typeof caricaDatiPagina === 'function') {
        try {
            const datiCloud = await caricaDatiPagina("operativita");
            if (datiCloud && datiCloud.trades) {
                trades = datiCloud.trades;
            }
        } catch (error) {
            console.log("Usando dati locali - errore caricamento cloud:", error);
        }
    }

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
        <title>Trade12 - Report Completo Trading</title>
        <style>
            body { 
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
    margin: 20px; 
    line-height: 1.6;
    color: #ececf1;
    background-color: #9d9598;
}
.header {
    text-align: center;
    margin-bottom: 30px;
    padding: 30px 20px;
    background: linear-gradient(135deg, #4d3470 0%, #2b193a 100%);
    color: #ececf1;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.24);
}
.header h1 {
    margin: 0 0 10px 0;
    font-size: 2.5em;
    font-weight: 300;
}
.trade-card {
    margin-bottom: 40px;
    page-break-inside: avoid;
    background: #22242a;
    color: #ececf1;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.24);
    border: 1px solid #2d313a;
}
.trade-title {
    background: linear-gradient(135deg, #184636 0%, #14532d 100%);
    color: #ececf1;
    padding: 20px;
    font-size: 1.3em;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;
}
.trade-content {
    padding: 25px;
}
.summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
    padding: 20px;
    background: linear-gradient(135deg, #24262d 0%, #2d313a 100%);
    border-radius: 8px;
    border-left: 4px solid #2293fa;
}
.summary-item {
    display: flex;
    flex-direction: column;
    padding: 15px;
    background: #22242a;
    color: #ececf1;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.label {
    font-weight: 600;
    color: #b0b3bd;
    font-size: 0.85em;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
}
.value {
    font-size: 1.2em;
    font-weight: 700;
}
.positive { 
    color: #26c281; 
    background: linear-gradient(135deg, #223f31 0%, #14452c 100%);
    padding: 6px 12px;
    border-radius: 6px;
}
.negative { 
    color: #ff4d6d; 
    background: linear-gradient(135deg, #3f1b2a 0%, #522231 100%);
    padding: 8px 12px;
    border-radius: 6px;
}
.neutral { 
    color: #ececf1;
    background: linear-gradient(135deg, #292c35 0%, #23262f 100%);
    padding: 8px 12px;
    border-radius: 6px;
}
table {
    width: 100%;
    border-collapse: collapse;
    margin: 25px 0;
    background: #22242a;
    color: #ececf1;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0,0,0,0.18);
}
th, td {
    padding: 15px 12px;
    text-align: left;
    border-bottom: 1px solid #2d313a;
}
th {
    background: linear-gradient(135deg, #353850 0%, #23243b 100%);
    color: #ececf1;
    font-weight: 600;
    font-size: 0.9em;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
tr:hover {
    background-color: #2d313a;
}
.footer {
    margin-top: 40px;
    text-align: center;
    font-size: 0.9em;
    color: #b0b3bd;
    border-top: 2px solid #353850;
    padding-top: 30px;
    background: #23262f;
    padding: 30px;
    border-radius: 12px;
}
.portfolio-summary {
    background: linear-gradient(135deg, #1f2632 0%, #20476b 100%);
    padding: 30px;
    border-radius: 12px;
    margin-bottom: 30px;
    border-left: 6px solid #2293fa;
    box-shadow: 0 4px 20px rgba(34, 147, 250, 0.15);
}
.portfolio-summary h2 {
    color: #fff;
    margin-top: 0;
    font-size: 1.8em;
    font-weight: 300;
}
.metadata {
    font-size: 0.85em;
    color: #b0b3bd;
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid #2d313a;
    line-height: 2;
}
.trade-number {
    background: rgba(255,255,255,0.07);
    padding: 5px 15px;
    border-radius: 20px;
    font-size: 0.9em;
    font-weight: 600;
}
@media print {
    body { 
        margin: 0; 
        background: white;
        color: #333;
    }
    .trade-card { 
        page-break-inside: avoid;
        box-shadow: none;
        border: 1px solid #ddd;
    }
    .header {
        background: #667eea !important;
        color: #fff !important;
        -webkit-print-color-adjust: exact;
    }
}

        </style>
    </head>
    <body>
        <div class="header">
            <h1>〽️​ Invest Flow</h1>
            <p>Trade Attivi</p>
            <p>Report generato il ${new Date().toLocaleString('it-IT')}</p>
        </div>
    `;

    // Calcola riepilogo portfolio
    let totalInvestmentPortfolio = 0;
    let totalCurrentValuePortfolio = 0;
    let totalPnlPortfolio = 0;
    let tradesPositivi = 0;
    let tradesNegativi = 0;
    
    // Mostra indicatore di caricamento
    const loadingDiv = document.createElement('div');
    loadingDiv.innerHTML = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                    background: white; padding: 30px; border-radius: 12px; 
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000;
                    text-align: center; font-family: Arial, sans-serif;">
            <div style="font-size: 1.2em; margin-bottom: 15px;">📊 Generazione Report</div>
            <div style="width: 200px; height: 4px; background: #e9ecef; border-radius: 2px; overflow: hidden;">
                <div id="progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); transition: width 0.3s;"></div>
            </div>
            <div style="margin-top: 10px; font-size: 0.9em; color: #6c757d;">Elaborazione dati di mercato...</div>
        </div>
    `;
    document.body.appendChild(loadingDiv);

    for (let index = 0; index < trades.length; index++) {
        // Aggiorna progress bar
        const progress = ((index + 1) / trades.length) * 100;
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) progressBar.style.width = progress + '%';

        const trade = trades[index];
        const stats = calcolaStatisticheTrade(trade.entries);
        const { totalInvestment, totalQuantity, avgPrice } = stats;
        
        // Ottieni prezzo attuale con retry logic
        let currentPrice = null;
        let attempts = 0;
        while (attempts < 3 && !currentPrice) {
            currentPrice = await getPriceFromBinance(trade.symbol);
            if (!currentPrice) {
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Attendi 1 secondo
            }
        }
        
        const currentValue = currentPrice ? totalQuantity * currentPrice : totalInvestment;
        const pnl = currentValue - totalInvestment;
        const pnlPercent = totalInvestment > 0 ? (pnl / totalInvestment) * 100 : 0;
        
        // Aggiorna statistiche portfolio
        totalInvestmentPortfolio += totalInvestment;
        totalCurrentValuePortfolio += currentValue;
        totalPnlPortfolio += pnl;
        
        if (pnl > 0) tradesPositivi++;
        else if (pnl < 0) tradesNegativi++;
        
        const pnlClass = pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : 'neutral';
        const pnlIcon = pnl > 0 ? '📈' : pnl < 0 ? '📉' : '➖';

        // Genera tabella entries con stile migliorato
        let entriesHtml = '';
        trade.entries.forEach((entry, entryIndex) => {
            const profit = currentPrice ? (currentPrice - entry.priceAtPurchase) * entry.quantity : 0;
            const profitPercent = entry.priceAtPurchase > 0 ? ((currentPrice - entry.priceAtPurchase) / entry.priceAtPurchase) * 100 : 0;
            const profitClass = profit > 0 ? 'positive' : profit < 0 ? 'negative' : 'neutral';
            
            entriesHtml += `
                <tr>
                    <td><strong>#${entryIndex + 1}</strong></td>
                    <td>${entry.quantity.toFixed(8)}</td>
                    <td>$${entry.priceAtPurchase.toFixed(4)}</td>
                    <td><strong>$${entry.investedAmount.toFixed(2)}</strong></td>
                    <td>${new Date(entry.timestamp).toLocaleDateString('it-IT')}</td>
                    <td class="${profitClass}">$${profit.toFixed(2)} (${profitPercent.toFixed(1)}%)</td>
                </tr>
            `;
        });

        // Calcola performance rispetto al mercato
        const marketPerformance = currentPrice && avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;
        const marketIcon = marketPerformance > 0 ? '🚀' : marketPerformance < 0 ? '📉' : '➖';

        htmlContent += `
        <div class="trade-card">
            <div class="trade-title">
                🪙 ${trade.symbol.toUpperCase()} 
                <span class="trade-number">Trade #${String(trades.length - index).padStart(2, '0')}</span>
                <div style="margin-left: auto;">${pnlIcon}</div>
            </div>
            
            <div class="trade-content">
                <h3 style="color: #CFECEC; margin-top: 0;">📊 Riepilogo Finanziario</h3>
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="label">💰 Quantità Totale</div>
                        <div class="value">${totalQuantity.toFixed(8)} ${trade.symbol.toUpperCase()}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">📊 Prezzo Medio Acquisto</div>
                        <div class="value">$${avgPrice.toFixed(4)}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">💵 Investimento Totale</div>
                        <div class="value">$${totalInvestment.toFixed(2)}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">📈 Prezzo Attuale</div>
                        <div class="value">${currentPrice ? '$' + currentPrice.toFixed(4) : '⚠️ Non disponibile'}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">💎 Valore Attuale</div>
                        <div class="value">$${currentValue.toFixed(2)}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">${pnlIcon} Profitto/Perdita</div>
                        <div class="value ${pnlClass}">$${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)</div>
                    </div>
                </div>

                <h4 style="color: #CFECEC;">📋 Storico Entry Dettagliato</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Entry</th>
                            <th>Quantità</th>
                            <th>Prezzo Acquisto</th>
                            <th>Importo Investito</th>
                            <th>Data</th>
                            <th>P&L Entry</th>
                        </tr>
                    </thead>
                    <tbody>${entriesHtml}</tbody>
                </table>
                
                <div class="metadata">
                    <div><strong>📅 Creato il:</strong> ${new Date(trade.createdAt).toLocaleDateString('it-IT', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}</div>
                    <div><strong>🔄 Ultimo aggiornamento:</strong> ${new Date(trade.updatedAt).toLocaleDateString('it-IT', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}</div>
                    <div><strong>📊 Performance vs Mercato:</strong> <span class="${marketPerformance > 0 ? 'positive' : marketPerformance < 0 ? 'negative' : 'neutral'}">${marketIcon} ${marketPerformance.toFixed(2)}%</span></div>
                    <div><strong>📈 Numero Entry:</strong> ${trade.entries.length}</div>
                </div>
            </div>
        </div>
        `;
    }

    // Rimuovi loading
    document.body.removeChild(loadingDiv);

    // Calcola statistiche portfolio avanzate
    const portfolioPnlPercent = totalInvestmentPortfolio > 0 ? (totalPnlPortfolio / totalInvestmentPortfolio) * 100 : 0;
    const portfolioPnlClass = totalPnlPortfolio > 0 ? 'positive' : totalPnlPortfolio < 0 ? 'negative' : 'neutral';
    const successRate = trades.length > 0 ? (tradesPositivi / trades.length) * 100 : 0;
    const avgTradeSize = trades.length > 0 ? totalInvestmentPortfolio / trades.length : 0;

    // Riepilogo portfolio finale migliorato
    htmlContent += `
        <div class="portfolio-summary">
            <h2>💼 Riepilogo Portfolio Trade</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="label">🎯 Trade Attivi</div>
                    <div class="value">${trades.length}</div>
                </div>
                <div class="summary-item">
                    <div class="label">💰 Capitale Investito</div>
                    <div class="value">$${totalInvestmentPortfolio.toFixed(2)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">💎 Valore Attuale</div>
                    <div class="value">$${totalCurrentValuePortfolio.toFixed(2)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">📊 P&L Totale</div>
                    <div class="value ${portfolioPnlClass}">$${totalPnlPortfolio.toFixed(2)} (${portfolioPnlPercent.toFixed(2)}%)</div>
                </div>
                <div class="summary-item">
                    <div class="label">✅ Trade Positivi</div>
                    <div class="value positive">${tradesPositivi}</div>
                </div>
                <div class="summary-item">
                    <div class="label">❌ Trade Negativi</div>
                    <div class="value negative">${tradesNegativi}</div>
                </div>
                <div class="summary-item">
                    <div class="label">🎯 Tasso Successo</div>
                    <div class="value ${successRate >= 50 ? 'positive' : 'negative'}">${successRate.toFixed(1)}%</div>
                </div>
                <div class="summary-item">
                    <div class="label">📊 Trade Medio</div>
                    <div class="value">$${avgTradeSize.toFixed(2)}</div>
                </div>
            </div>
            
           <div class="analysis-box">
    <h3>📈 Analisi Performance</h3>
    <p><strong>Diversificazione:</strong> Portfolio distribuito su ${trades.length} asset crypto differenti</p>
    <p><strong>Strategia:</strong> ${trades.length > 5 ? 'Diversificazione alta' : trades.length > 2 ? 'Diversificazione media' : 'Concentrazione alta'}</p>
    <p><strong>Rischio:</strong> ${portfolioPnlPercent > 20 ? 'Alto rendimento/Alto rischio' : portfolioPnlPercent > 0 ? 'Profittevole' : 'In fase di recupero'}</p>
</div>

        </div>
    `;

    htmlContent += `
        <div class="footer">
            <h3>🚀 TRADE 4H - Sistema Trading Professionale</h3>
            <p>📊 Report automatico generato con dati in tempo reale</p>
            <p>🕒 Timestamp: ${new Date().toLocaleString('it-IT')}</p>
            <p>💻 Sviluppato per il monitoraggio avanzato del portfolio crypto</p>
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6;">
                <small>⚠️ I dati di prezzo sono forniti da CoinGecko API. Le performance passate non garantiscono risultati futuri.</small>
            </div>
        </div>
    </body>
    </html>
    `;

    // Salva e scarica il report
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `TRADE4H-Report-${timestamp}.html`;
    downloadLink.style.display = 'none';
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);

    // Notifica successo
    mostrarMessaggio("✅ Report TRADE4H generato e scaricato con successo!");
    
    // Salva automaticamente i dati aggiornati nel cloud
    if (typeof salvaDatiPagina === 'function') {
        try {
            await salvaDatiPagina("operativita", {
                trades: trades,
                ultimoReport: timestamp,
                ultimoAggiornamento: new Date().toISOString()
            });
            console.log("✅ Dati sincronizzati con il cloud dopo generazione report");
        } catch (error) {
            console.log("⚠️ Errore sincronizzazione cloud:", error);
        }
    }
}

// Funzione di supporto per mostrare messaggi (se non già presente)
function mostrarMessaggio(messaggio) {
    // Verifica se la funzione esiste già
    if (typeof window.mostrarMessaggio === 'function') {
        return window.mostrarMessaggio(messaggio);
    }
    
    // Crea un toast notification migliorato
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        z-index: 10000;
        transition: all 0.3s ease;
        box-shadow: 0 4px 20px rgba(76, 175, 80, 0.3);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-weight: 500;
        max-width: 400px;
    `;
    toast.textContent = messaggio;
    
    document.body.appendChild(toast);
    
    // Animazione di entrata
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    }, 100);
    
    // Rimozione automatica
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 4000);
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


// Inizializzazione
document.addEventListener('DOMContentLoaded', function() {
    loadTrades();
    renderTrades();
});

// 🟢  EVENTI per apertura / chiusura trade
function emitTradeEvent(delta) {
  localStorage.setItem('__tradeEvent__', JSON.stringify({ delta, ts: Date.now() }));
}

// sovrascrivi saveTrades per rilevare NUOVI trade
const _saveTrades = saveTrades;
saveTrades = () => {
  const old = JSON.parse(localStorage.getItem('singleTrades') || '[]').length;
  _saveTrades();
  if (trades.length > old) emitTradeEvent(+1);        // APERTO
};

// sovrascrivi deleteTrade
const _deleteTrade = window.deleteTrade;
window.deleteTrade = id => {
  if (confirm('Eliminare questo trade?')) {
    trades = trades.filter(t => t.id !== id);
    saveTrades();
    renderTrades();
    emitTradeEvent(-1);                              // CHIUSO
  }
};

// ------------------------------------------------------------------
//  Prezzi da Binance (nessuna API key richiesta)
// ------------------------------------------------------------------
async function getPriceFromBinance(symbol) {
    const pair = `${symbol.toUpperCase()}USDT`;
    const cacheKey = pair.toLowerCase();
    const now = Date.now();

    // cache 5 min
    if (priceCache[cacheKey] && (now - priceCache[cacheKey].timestamp) < CACHE_DURATION) {
        return priceCache[cacheKey].price;
    }

    try {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
        if (!res.ok) throw new Error(res.status);
        const data = await res.json();
        const price = parseFloat(data.price);
        priceCache[cacheKey] = { price, timestamp: now };
        return price;
    } catch {
        console.warn(`Binance: ${pair} non trovato`);
        return null; // se vuoi un fallback, gestiscilo altrove
    }
}

// 🧠 Aggiorna anche al caricamento pagina
document.addEventListener('DOMContentLoaded', updateTradeCount);

// Sovrascrivi saveTrades per aggiornare il contatore anche nella stessa pagina
const originalSaveTrades = saveTrades;
saveTrades = () => {
  originalSaveTrades();
  updateTradeCount(); // 👈 forza aggiornamento contatore
};
// 🔄 Contatore reattivo trade attivi
function updateTradeCount() {
  const trades = JSON.parse(localStorage.getItem('singleTrades') || '[]');
  const count = trades.length;
  const span = document.getElementById('trade-count');
  if (span) span.textContent = count;
}

// 📡 Ascolta eventi di apertura/chiusura trade
window.addEventListener('storage', (e) => {
  if (e.key === '__tradeEvent__') {
    updateTradeCount();
  }
});
