// tradeAnalysis.js - Script per l'analisi dei trade attivi

// Variabili globali per i grafici
let pnlChart = null;
let timelineChart = null;
let performanceChart = null;

// Cache per i prezzi
let priceCache = {};
const CACHE_DURATION = 5 * 60 * 1000;

// Mappa ID CoinGecko
const coinGeckoIdMap = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'BNB': 'binancecoin',
    'ADA': 'cardano',
    'DOT': 'polkadot',
    'LINK': 'chainlink',
    'XRP': 'ripple',
    'LTC': 'litecoin',
    'SOL': 'solana',
    'MATIC': 'matic-network',
    'AVAX': 'avalanche-2',
    'ATOM': 'cosmos',
    'ALGO': 'algorand',
    'FET': 'artificial-superintelligence-alliance',
    'NEAR': 'near'
};

// Ottieni prezzo da Binance
async function getPriceFromBinance(symbol) {
    const pair = `${symbol.toUpperCase()}USDC`;
    const cacheKey = pair.toLowerCase();
    const now = Date.now();

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
        return null;
    }
}

// Carica trade da localStorage
function caricaTrades() {
    const saved = localStorage.getItem('singleTrades');
    if (saved) {
        return JSON.parse(saved);
    }
    return [];
}

// Calcola statistiche trade
function calcolaStatisticheTrade(entries) {
    let totalInvestment = 0;
    let totalQuantity = 0;
    
    entries.forEach(entry => {
        totalInvestment += entry.investedAmount;
        totalQuantity += entry.quantity;
    });
    
    const avgPrice = totalQuantity > 0 ? totalInvestment / totalQuantity : 0;
    
    return { totalInvestment, totalQuantity, avgPrice };
}

// Calcola giorni in posizione
function calcolaGiorniInPosizione(trade) {
    if (!trade.entries || trade.entries.length === 0) return 0;
    
    const primaEntry = new Date(trade.entries[0].timestamp);
    const oggi = new Date();
    const differenzaMs = oggi - primaEntry;
    return Math.floor(differenzaMs / (1000 * 60 * 60 * 24));
}

// Elabora dati per i grafici
async function elaboraDatiTrade() {
    const trades = caricaTrades();
    
    if (trades.length === 0) {
        return null;
    }

    const datiElaborati = [];
    
    // Mostra loading
    mostrarLoading();

    for (const trade of trades) {
        const stats = calcolaStatisticheTrade(trade.entries);
        const currentPrice = await getPriceFromBinance(trade.symbol);
        
        if (!currentPrice) continue;
        
        const currentValue = stats.totalQuantity * currentPrice;
        const pnl = currentValue - stats.totalInvestment;
        const pnlPercent = stats.totalInvestment > 0 ? (pnl / stats.totalInvestment) * 100 : 0;
        const giorniInPosizione = calcolaGiorniInPosizione(trade);
        
        datiElaborati.push({
            symbol: trade.symbol.toUpperCase(),
            totalInvestment: stats.totalInvestment,
            currentValue: currentValue,
            pnl: pnl,
            pnlPercent: pnlPercent,
            avgPrice: stats.avgPrice,
            currentPrice: currentPrice,
            entries: trade.entries,
            giorniInPosizione: giorniInPosizione,
            createdAt: trade.createdAt
        });
    }

    return datiElaborati;
}

// Mostra loading
function mostrarLoading() {
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = '<div class="loading">⏳ Caricamento dati di mercato...</div>';
}

// Aggiorna statistiche generali
function aggiornaStatistiche(dati) {
    if (!dati || dati.length === 0) {
        // Mostra comunque le statistiche dei trade chiusi se esistono
        const statsChiusi = getStatisticheTradesChiusi();
        
        if (statsChiusi.totaleChiusi > 0) {
            const statsHtml = `
                <div class="empty-state" style="grid-column: 1 / -1; margin-bottom: 20px;">
                    <div class="empty-state-icon">📊</div>
                    <h2>Nessun trade attivo</h2>
                    <p>Ma hai ${statsChiusi.totaleChiusi} trade nello storico</p>
                </div>
                <div class="stat-card">
                    <div class="stat-label">🏆 Trade Chiusi in Positivo</div>
                    <div class="stat-value positive">${statsChiusi.chiusiPositivi}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">❌ Trade Chiusi in Negativo</div>
                    <div class="stat-value negative">${statsChiusi.chiusiNegativi}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">📊 P&L Storico Totale</div>
                    <div class="stat-value ${statsChiusi.totalePnLChiusi >= 0 ? 'positive' : 'negative'}">
                        $${statsChiusi.totalePnLChiusi.toFixed(2)}
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">🎯 Win Rate Storico</div>
                    <div class="stat-value ${statsChiusi.winRateChiusi >= 50 ? 'positive' : 'negative'}">
                        ${statsChiusi.winRateChiusi.toFixed(1)}%
                    </div>
                </div>
            `;
            document.getElementById('statsGrid').innerHTML = statsHtml;
        } else {
            document.getElementById('statsGrid').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <h2>Nessun trade attivo</h2>
                    <p>Inizia a fare trading per vedere le statistiche</p>
                </div>
            `;
        }
        return;
    }

    // Statistiche trade attivi
    const totalePnl = dati.reduce((sum, t) => sum + t.pnl, 0);
    const totaleInvestito = dati.reduce((sum, t) => sum + t.totalInvestment, 0);
    const totaleValore = dati.reduce((sum, t) => sum + t.currentValue, 0);
    const pnlPercent = totaleInvestito > 0 ? (totalePnl / totaleInvestito) * 100 : 0;
    const tradePositivi = dati.filter(t => t.pnl > 0).length;
    const tradeNegativi = dati.filter(t => t.pnl < 0).length;
    const giorniMedi = dati.reduce((sum, t) => sum + t.giorniInPosizione, 0) / dati.length;

    // Statistiche trade chiusi
    const statsChiusi = getStatisticheTradesChiusi();

    const statsHtml = `
        <div class="stat-card">
            <div class="stat-label">🎯 Trade Attivi</div>
            <div class="stat-value">${dati.length}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">💰 Capitale Investito</div>
            <div class="stat-value">$${totaleInvestito.toFixed(0)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">💎 Valore Attuale</div>
            <div class="stat-value">$${totaleValore.toFixed(2)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">📊 P&L Attivi</div>
            <div class="stat-value ${totalePnl >= 0 ? 'positive' : 'negative'}">
                $${totalePnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-label">✅ Trade Attivi Positivi</div>
            <div class="stat-value positive">${tradePositivi}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">❌ Trade Attivi Negativi</div>
            <div class="stat-value negative">${tradeNegativi}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">🏆 Trade Chiusi in Positivo</div>
            <div class="stat-value positive">${statsChiusi.chiusiPositivi}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">💀 Trade Chiusi in Negativo</div>
            <div class="stat-value negative">${statsChiusi.chiusiNegativi}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">⏱️ Giorni Medi in Posizione</div>
            <div class="stat-value">${giorniMedi.toFixed(1)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">🎯 Win Rate Attivi</div>
            <div class="stat-value ${tradePositivi > tradeNegativi ? 'positive' : 'negative'}">
                ${((tradePositivi / dati.length) * 100).toFixed(1)}%
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-label">🎯 Win Rate Storico</div>
            <div class="stat-value ${statsChiusi.winRateChiusi >= 50 ? 'positive' : 'negative'}">
                ${statsChiusi.totaleChiusi > 0 ? statsChiusi.winRateChiusi.toFixed(1) : '0.0'}%
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-label">📊 P&L Storico</div>
            <div class="stat-value ${statsChiusi.totalePnLChiusi >= 0 ? 'positive' : 'negative'}">
                $${statsChiusi.totalePnLChiusi.toFixed(2)}
            </div>
        </div>
    `;

    document.getElementById('statsGrid').innerHTML = statsHtml;
}

// ========================================
// FUNZIONE BONUS: Visualizza storico completo
// ========================================

function mostraStoricoCompleto() {
    const tradesChiusi = JSON.parse(localStorage.getItem('closedTrades') || '[]');
    
    if (tradesChiusi.length === 0) {
        alert('Nessun trade chiuso nello storico');
        return;
    }
    
    console.table(tradesChiusi.map(t => ({
        Symbol: t.symbol,
        'Data Chiusura': new Date(t.closedAt).toLocaleDateString('it-IT'),
        'P&L $': t.finalPnL.toFixed(2),
        'P&L %': t.finalPnLPercent.toFixed(2) + '%',
        'Giorni': t.giorniInPosizione,
        'Investito': '$' + t.totalInvestment.toFixed(2),
        'Valore Finale': '$' + t.closeValue.toFixed(2)
    })));
}

// ========================================
// FUNZIONE BONUS: Reset storico (usa con cautela!)
// ========================================

function resetStoricoTradesChiusi() {
    if (confirm('ATTENZIONE: Vuoi cancellare TUTTO lo storico dei trade chiusi? Questa operazione è irreversibile!')) {
        if (confirm('Sei DAVVERO sicuro? Tutti i dati storici saranno persi!')) {
            localStorage.removeItem('closedTrades');
            alert('Storico trade chiusi eliminato');
            location.reload();
        }
    }
}

// Crea grafico P&L
function creaGraficoPnL(dati) {
    const ctx = document.getElementById('pnlChart').getContext('2d');
    
    if (pnlChart) {
        pnlChart.destroy();
    }

    // Ordina per P&L
    const datiOrdinati = [...dati].sort((a, b) => b.pnl - a.pnl);

    const colori = datiOrdinati.map(d => d.pnl >= 0 ? 'rgba(38, 194, 129, 0.8)' : 'rgba(255, 77, 109, 0.8)');
    const bordi = datiOrdinati.map(d => d.pnl >= 0 ? '#26c281' : '#ff4d6d');

    pnlChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: datiOrdinati.map(d => d.symbol),
            datasets: [{
                label: 'P&L ($)',
                data: datiOrdinati.map(d => d.pnl),
                backgroundColor: colori,
                borderColor: bordi,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(24, 28, 35, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#667eea',
                    borderWidth: 2,
                    padding: 15,
                    callbacks: {
                        label: function(context) {
                            const trade = datiOrdinati[context.dataIndex];
                            return [
                                `P&L: $${trade.pnl.toFixed(2)}`,
                                `P&L %: ${trade.pnlPercent.toFixed(2)}%`,
                                `Investito: $${trade.totalInvestment.toFixed(2)}`,
                                `Valore: $${trade.currentValue.toFixed(2)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#b0b3bd',
                        callback: function(value) {
                            return '$' + value.toFixed(0);
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#b0b3bd',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                }
            }
        }
    });
}

// Crea grafico Timeline
function creaGraficoTimeline(dati) {
    const ctx = document.getElementById('timelineChart').getContext('2d');
    
    if (timelineChart) {
        timelineChart.destroy();
    }

    // Prepara dati per la timeline
    const datasets = [];
    const colori = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140', '#30cfd0'];

    dati.forEach((trade, index) => {
        const datiEntry = trade.entries.map(entry => ({
            x: new Date(entry.timestamp),
            y: entry.investedAmount
        }));

        datasets.push({
            label: trade.symbol,
            data: datiEntry,
            backgroundColor: colori[index % colori.length],
            borderColor: colori[index % colori.length],
            borderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8
        });
    });

    timelineChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#b0b3bd',
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(24, 28, 35, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#667eea',
                    borderWidth: 2,
                    padding: 15,
                    callbacks: {
                        label: function(context) {
                            const data = context.raw;
                            return [
                                `${context.dataset.label}`,
                                `Investito: $${data.y.toFixed(2)}`,
                                `Data: ${data.x.toLocaleDateString('it-IT')}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'dd/MM'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Data Entry',
                        color: '#b0b3bd'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#b0b3bd'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Importo Investito ($)',
                        color: '#b0b3bd'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#b0b3bd',
                        callback: function(value) {
                            return '$' + value.toFixed(0);
                        }
                    }
                }
            }
        }
    });
}

// Crea grafico Performance
function creaGraficoPerformance(dati) {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    
    if (performanceChart) {
        performanceChart.destroy();
    }

    const datiScatter = dati.map(trade => ({
        x: trade.giorniInPosizione,
        y: trade.pnlPercent,
        symbol: trade.symbol
    }));

    const colori = datiScatter.map(d => d.y >= 0 ? 'rgba(38, 194, 129, 0.7)' : 'rgba(255, 77, 109, 0.7)');

    performanceChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Trade',
                data: datiScatter,
                backgroundColor: colori,
                borderColor: colori.map(c => c.replace('0.7', '1')),
                borderWidth: 2,
                pointRadius: 8,
                pointHoverRadius: 12
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(24, 28, 35, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#667eea',
                    borderWidth: 2,
                    padding: 15,
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            return [
                                `${point.symbol}`,
                                `Giorni: ${point.x}`,
                                `Rendimento: ${point.y.toFixed(2)}%`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Giorni in Posizione',
                        color: '#b0b3bd',
                        font: {
                            size: 14
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#b0b3bd'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Rendimento (%)',
                        color: '#b0b3bd',
                        font: {
                            size: 14
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#b0b3bd',
                        callback: function(value) {
                            return value.toFixed(1) + '%';
                        }
                    }
                }
            }
        }
    });
}

// Scarica grafico
function scaricaGrafico(canvasId, nomeFile) {
    const canvas = document.getElementById(canvasId);
    const link = document.createElement('a');
    const oggi = new Date().toISOString().split('T')[0];
    
    link.download = `${nomeFile}-${oggi}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Aggiorna tutti i grafici
async function aggiornaGrafici() {
    const dati = await elaboraDatiTrade();
    
    if (!dati || dati.length === 0) {
        document.getElementById('statsGrid').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <h2>Nessun trade attivo</h2>
                <p>Inizia a fare trading per vedere le statistiche</p>
            </div>
        `;
        return;
    }

    aggiornaStatistiche(dati);
    creaGraficoPnL(dati);
    creaGraficoTimeline(dati);
    creaGraficoPerformance(dati);
}

// Inizializza al caricamento della pagina
document.addEventListener('DOMContentLoaded', function() {
    aggiornaGrafici();
    
    // Aggiorna automaticamente ogni 5 minuti
    setInterval(aggiornaGrafici, 5 * 60 * 1000);
});
// ========================================
// FUNZIONI DA AGGIUNGERE A tradeAnalysis.js
// ========================================

// 5. Funzione per ottenere statistiche trade chiusi
function getStatisticheTradesChiusi() {
    const tradesChiusi = JSON.parse(localStorage.getItem('closedTrades') || '[]');
    
    const totaleChiusi = tradesChiusi.length;
    const chiusiPositivi = tradesChiusi.filter(t => t.finalPnL > 0).length;
    const chiusiNegativi = tradesChiusi.filter(t => t.finalPnL < 0).length;
    const totalePnLChiusi = tradesChiusi.reduce((sum, t) => sum + t.finalPnL, 0);
    
    return {
        totaleChiusi,
        chiusiPositivi,
        chiusiNegativi,
        totalePnLChiusi,
        winRateChiusi: totaleChiusi > 0 ? (chiusiPositivi / totaleChiusi) * 100 : 0
    };
}
