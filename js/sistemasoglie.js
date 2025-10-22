// --- CONFIGURAZIONE SOGLIE PROGRESSIVE (con reinvestimento del 40%) ---
const REINVEST_PERCENT = 0.4; // 40% del profitto viene reinvestito
const THRESHOLD_PERCENTS = [
    { level: 1, percent: 0.19, description: "Soglia Base - Crescita del 19%" },
    { level: 2, percent: 0.49, description: "Soglia Intermedia - Crescita del 49%" },
    { level: 3, percent: 0.86, description: "Soglia Avanzata - Crescita del 86%" },
    { level: 4, percent: 1.23, description: "Soglia Professionale - Crescita del 123%" },
    { level: 5, percent: 1.98, description: "Soglia Elite - Crescita del 198%" }
];

const MAX_TRADES = 30;

// Storico dei ritiri e dei reinvestimenti
let withdrawalHistory = [];
let reinvestedHistory = [];

// Funzioni per integrare con il sistema esistente
function calculateTotalEarned() {
    if (typeof historicalEntries !== 'undefined' && typeof currentMonthEntries !== 'undefined') {
        const historicalSum = historicalEntries.reduce((acc, entry) => acc + parseFloat(entry.importo), 0);
        const currentSum = currentMonthEntries.reduce((acc, entry) => acc + parseFloat(entry.importo), 0);
        return historicalSum + currentSum;
    }
    return 0;
}

function getTotalTradesCount() {
    if (typeof window.tradeClickCount !== 'undefined') {
        return window.tradeClickCount;
    }
    if (typeof currentMonthEntries !== 'undefined' && typeof historicalEntries !== 'undefined') {
        return currentMonthEntries.length + historicalEntries.length;
    }
    return 0;
}

// Inizializza il contatore dei trade se non esiste
if (typeof window.tradeClickCount === 'undefined') {
    window.tradeClickCount = 0;
}

// Intercetta i click del pulsante addButton se esiste
function setupTradeCounter() {
    const addButton = document.getElementById('addButton');
    if (addButton) {
        addButton.addEventListener('click', function() {
            window.tradeClickCount++;
            if (!document.getElementById('resultsContainer').classList.contains('hidden')) {
                setTimeout(calculateThresholds, 500);
            }
        });
    }
}

let currentData = {
    initialCapital: 6000,
    currentEarnings: 0,
    tradesCompleted: 0,
    currentCapital: 6000,
    currentThresholdIndex: 0
};

function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = message;
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alert);
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// --- GENERA SOGLIE PROGRESSIVE CON REINVESTIMENTO PARZIALE ---
function generateThresholdProgressive(initialCapital) {
    let thresholds = [];
    let baseCapital = initialCapital;

    for (let i = 0; i < THRESHOLD_PERCENTS.length; i++) {
        const config = THRESHOLD_PERCENTS[i];
        const profitTarget = baseCapital * config.percent;
        const reinvest = profitTarget * REINVEST_PERCENT;
        const withdrawal = profitTarget - reinvest;
        const targetCapital = baseCapital + profitTarget;

        thresholds.push({
            level: config.level,
            baseCapital: baseCapital,
            profitTarget: profitTarget,
            reinvest: reinvest,
            withdrawal: withdrawal,
            targetCapital: targetCapital,
            tradeValue: Math.round(baseCapital / MAX_TRADES),
	// per quota trade da capitale iniziale		tradeValue: Math.round(initialCapital / MAX_TRADES)
            maxTrades: MAX_TRADES,
            description: config.description
        });

        // Solo la quota reinvestita va aggiunta al capitale per la soglia successiva
        baseCapital = baseCapital + reinvest;
    }
    return thresholds;
}

function getCurrentThreshold() {
    const capital = currentData.currentCapital;
    const thresholds = generateThresholdProgressive(currentData.initialCapital);
    for (let i = 0; i < thresholds.length; i++) {
        if (capital < thresholds[i].targetCapital) {
            return i;
        }
    }
    return thresholds.length - 1;
}

function calculateProgress() {
    const thresholdIndex = getCurrentThreshold();
    const thresholds = generateThresholdProgressive(currentData.initialCapital);
    const currentThreshold = thresholds[thresholdIndex];
    const capital = currentData.currentCapital;
    if (thresholdIndex === 0) {
        const progress = ((capital - currentThreshold.baseCapital) / (currentThreshold.targetCapital - currentThreshold.baseCapital)) * 100;
        return Math.max(0, Math.min(100, progress));
    } else {
        const prevThreshold = thresholds[thresholdIndex - 1];
        const progress = ((capital - prevThreshold.targetCapital) / (currentThreshold.targetCapital - prevThreshold.targetCapital)) * 100;
        return Math.max(0, Math.min(100, progress));
    }
}

function calculateTotalEarnPercent() {
    const earnPercent = (currentData.currentEarnings / currentData.initialCapital) * 100;
    return Math.max(0, earnPercent);
}

// Funzione per gestire ritiro e reinvestimento alla soglia
function handleThresholdReached(thresholdIndex) {
    const thresholds = generateThresholdProgressive(currentData.initialCapital);
    const currentThreshold = thresholds[thresholdIndex];
    const baseCapital = currentThreshold.baseCapital;
    const targetCapital = currentThreshold.targetCapital;
    const actualCapital = currentData.currentCapital;

    // Calcola profitto realizzato
    const profit = Math.max(0, actualCapital - baseCapital);

    // Calcola quota reinvestibile (es. 40%)
    const reinvest = profit * REINVEST_PERCENT;
    const toWithdraw = profit - reinvest;

    // Aggiorna storico
    withdrawalHistory.push({
        level: currentThreshold.level,
        amount: toWithdraw,
        date: new Date().toLocaleDateString()
    });
    reinvestedHistory.push({
        level: currentThreshold.level,
        amount: reinvest,
        date: new Date().toLocaleDateString()
    });

    // Aggiorna capitale operativo per la soglia successiva
    currentData.initialCapital = baseCapital + reinvest;
    currentData.currentEarnings = actualCapital - currentData.initialCapital;
    currentData.currentCapital = actualCapital;

    // Mostra alert
    showAlert(
        `Soglia ${currentThreshold.level} raggiunta! Profitto: ${formatCurrency(profit)}. 
        <br>Ritirato: <b>${formatCurrency(toWithdraw)}</b> | Reinvestito: <b>${formatCurrency(reinvest)}</b>.<br>
        Il nuovo capitale operativo per la prossima soglia è ${formatCurrency(currentData.initialCapital)}.`,
        'success'
    );
    updateHistoryDisplay();
}

function updateDisplay() {
    const thresholdIndex = getCurrentThreshold();
    const thresholds = generateThresholdProgressive(currentData.initialCapital);
    const currentThreshold = thresholds[thresholdIndex];
    const progress = calculateProgress();
    const totalEarnPercent = calculateTotalEarnPercent();
    const remainingTrades = Math.max(0, currentThreshold.maxTrades - currentData.tradesCompleted);
    const requiredGainPercent = ((currentThreshold.targetCapital - currentThreshold.baseCapital) / currentThreshold.baseCapital) * 100;

    // Aggiorna status cards
    document.getElementById('currentCapital').textContent = formatCurrency(currentData.currentCapital);
    document.getElementById('currentThreshold').textContent = `Soglia ${currentThreshold.level}`;
    document.getElementById('progressPercent').textContent = `${progress.toFixed(1)}%`;
    document.getElementById('totalEarnPercent').textContent = `${totalEarnPercent.toFixed(1)}%`;

    // Aggiorna progress bar
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${progress.toFixed(1)}%`;

    // Aggiorna limiti di trading
    document.getElementById('remainingTrades').textContent = remainingTrades;
    document.getElementById('tradeValue').textContent = formatCurrency(currentThreshold.tradeValue);
    document.getElementById('targetCapital').textContent = formatCurrency(currentThreshold.targetCapital);
    document.getElementById('requiredGainPercent').textContent = `${requiredGainPercent.toFixed(1)}%`;

    // Aggiorna griglia soglie
    updateThresholdGrid();

    // Controlli e avvisi
    if (remainingTrades <= 0) {
        showAlert('⚠️ Limite di trade raggiunto per questa soglia! Considera di passare alla soglia successiva.', 'warning');
    }

    if (progress >= 100) {
        if (thresholdIndex < thresholds.length - 1) {
            handleThresholdReached(thresholdIndex);
            showAlert('🎉 Congratulazioni! Hai raggiunto la soglia corrente. Puoi passare alla soglia successiva!', 'success');
        } else {
            handleThresholdReached(thresholdIndex);
            showAlert('🏆 Eccellente! Hai raggiunto la soglia massima del sistema!', 'success');
        }
    }
}

function updateThresholdGrid() {
    const grid = document.getElementById('thresholdGrid');
    const currentThresholdIndex = getCurrentThreshold();
    const thresholds = generateThresholdProgressive(currentData.initialCapital);

    grid.innerHTML = '';

    thresholds.forEach((threshold, index) => {
        const item = document.createElement('div');
        item.className = 'threshold-item';

        if (index < currentThresholdIndex) {
            item.classList.add('completed');
        } else if (index === currentThresholdIndex) {
            item.classList.add('current');
        } else {
            item.classList.add('future');
        }

        const progress = index === currentThresholdIndex ? calculateProgress() : 0;
        const earnPercent = (threshold.profitTarget / threshold.baseCapital) * 100;
        const status = index < currentThresholdIndex ? '✅ Completata' :
            index === currentThresholdIndex ? `🎯 Attuale (${progress.toFixed(1)}%)` :
                '⏳ Futura';

        item.innerHTML = `
            <div class="threshold-info">
                <div class="threshold-number">Soglia ${threshold.level}</div>
                <div class="threshold-amount">${formatCurrency(threshold.targetCapital)}</div>
            </div>
            <div class="threshold-details">
                <div><strong>Capitale Base:</strong> ${formatCurrency(threshold.baseCapital)}</div>
                <div><strong>Profitto Richiesto:</strong> ${formatCurrency(threshold.profitTarget)} (${earnPercent.toFixed(1)}%)</div>
                <div><strong>Quota Reinvestita:</strong> ${formatCurrency(threshold.reinvest)}</div>
                <div><strong>Quota Ritirabile:</strong> ${formatCurrency(threshold.withdrawal)}</div>
                <div><strong>Valore Trade:</strong> ${formatCurrency(threshold.tradeValue)}</div>
                <div><strong>Max Trade:</strong> ${threshold.maxTrades}</div>
                <div><strong>Status:</strong> ${status}</div>
                <div style="margin-top: 10px; font-style: italic; color: #6CC417;">${threshold.description}</div>
            </div>
        `;

        grid.appendChild(item);
    });
}

function updateHistoryDisplay() {
    const withdrawalDiv = document.getElementById('withdrawalHistory');
    const reinvestedDiv = document.getElementById('reinvestedHistory');
    if (withdrawalDiv) {
        withdrawalDiv.innerHTML = '<b>Ritiri:</b><br>' + withdrawalHistory.map(w =>
            `Soglia ${w.level}: ${formatCurrency(w.amount)} (${w.date})`
        ).join('<br>');
    }
    if (reinvestedDiv) {
        reinvestedDiv.innerHTML = '<b>Reinvestiti:</b><br>' + reinvestedHistory.map(r =>
            `Soglia ${r.level}: ${formatCurrency(r.amount)} (${r.date})`
        ).join('<br>');
    }
}

function calculateThresholds() {
    const initialCapital = parseFloat(document.getElementById('initialCapital').value) || 6000;
    const currentEarnings = calculateTotalEarned();
    const tradesCompleted = getTotalTradesCount();

    // Aggiorna i campi di input
    document.getElementById('initialCapital').value = initialCapital;
    document.getElementById('currentEarnings').value = currentEarnings.toFixed(2);
    document.getElementById('tradesCompleted').value = tradesCompleted;

    // Aggiorna i dati correnti
    currentData.initialCapital = initialCapital;
    currentData.currentEarnings = currentEarnings;
    currentData.tradesCompleted = tradesCompleted;
    currentData.currentCapital = initialCapital + currentEarnings;

    // Mostra i risultati
    document.getElementById('resultsContainer').classList.remove('hidden');

    // Aggiorna il display
    updateDisplay();

    showAlert('✅ Sistema di soglie aggiornato con successo!', 'success');
}

// Funzione per aggiornare automaticamente
function updateThresholdSystem() {
    calculateThresholds();
}

// Auto-aggiorna al caricamento
function autoUpdateOnLoad() {
    setTimeout(() => {
        setupTradeCounter();
        calculateThresholds();
    }, 1000);
}

// Event listeners
document.getElementById('calculateBtn').addEventListener('click', calculateThresholds);
document.getElementById('initialCapital').addEventListener('input', calculateThresholds);
document.getElementById('tradesCompleted').addEventListener('input', calculateThresholds);


// Auto-carica al caricamento della pagina
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoUpdateOnLoad);
} else {
    autoUpdateOnLoad();
}

// Espone le funzioni per l'integrazione esterna
window.updateThresholdSystem = updateThresholdSystem;
window.setupTradeCounter = setupTradeCounter;