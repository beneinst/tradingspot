// 1. operatività.js - PAGINA OPERATIVITA' ---

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



// SEZIONE CALCOLI OPERATIVI

        // Inizializzazione delle variabili
        let currentMonthEntries = [];
        let historicalEntries = [];
        
        // Caricare dati da localStorage se disponibili
        function loadFromLocalStorage() {
            const savedCurrentEntries = localStorage.getItem('currentMonthEntries');
            const savedHistoricalEntries = localStorage.getItem('historicalEntries');
            
            if (savedCurrentEntries) {
                currentMonthEntries = JSON.parse(savedCurrentEntries);
            }
            
            if (savedHistoricalEntries) {
                historicalEntries = JSON.parse(savedHistoricalEntries);
            }
        }
        
        // Salvare dati nel localStorage
        function saveToLocalStorage() {
            localStorage.setItem('currentMonthEntries', JSON.stringify(currentMonthEntries));
            localStorage.setItem('historicalEntries', JSON.stringify(historicalEntries));
        }
        
        // Funzione per formattare le date nel formato italiano
        function formatDate(date) {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = String(date.getFullYear()).slice(-2);
            return `${day}.${month}.${year}`;
        }
        
        // Funzione per formattare gli importi
        function formatImport(value) {
            return parseFloat(value).toFixed(2).replace('.', ',');
        }
        
        // Funzione per ottenere la data attuale
        function getCurrentDate() {
            const now = new Date();
            return formatDate(now);
        }
        
        // Aggiornare la data corrente
        document.getElementById('currentDate').textContent = getCurrentDate();
        
        // Funzione per calcolare la media degli importi mensili
        function calculateMonthlyAverage() {
            if (historicalEntries.length === 0) {
                return 0;
            }
            const sum = historicalEntries.reduce((acc, entry) => acc + parseFloat(entry.importo), 0);
            return sum / historicalEntries.length;
        }
        
        // Funzione per calcolare il totale guadagnato
        function calculateTotalEarned() {
            const historicalSum = historicalEntries.reduce((acc, entry) => acc + parseFloat(entry.importo), 0);
            const currentSum = currentMonthEntries.reduce((acc, entry) => acc + parseFloat(entry.importo), 0);
            return historicalSum + currentSum;
        }
        
        // Funzione per calcolare il valore del mese corrente
        function calculateCurrentMonthValue() {
            return currentMonthEntries.reduce((acc, entry) => acc + parseFloat(entry.importo), 0);
        }
        
        // Funzione per aggiornare le dashboard
        function updateDashboard() {
            const currentMonthValue = calculateCurrentMonthValue();
            const monthlyAverage = calculateMonthlyAverage();
            const totalEarn = calculateTotalEarned();
            
            document.getElementById('currentMonthValue').textContent = formatImport(currentMonthValue);
            document.getElementById('monthlyAverage').textContent = formatImport(monthlyAverage);
            document.getElementById('totalEarn').textContent = formatImport(totalEarn);
        }
        
        // Funzione per aggiornare la tabella del mese corrente
        function updateCurrentMonthTable() {
            const tableBody = document.querySelector('#currentMonthTable tbody');
            tableBody.innerHTML = '';
            
            currentMonthEntries.forEach(entry => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${entry.data}</td>
                    <td>${formatImport(entry.importo)}</td>
                `;
                tableBody.appendChild(row);
            });
        }
        
        // Funzione per aggiornare la tabella storica
        function updateHistoricalTable() {
            const tableBody = document.querySelector('#historicalTable tbody');
            tableBody.innerHTML = '';
            
            historicalEntries.forEach(entry => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${entry.periodo}</td>
                    <td>${formatImport(entry.importo)}</td>
                `;
                tableBody.appendChild(row);
            });
        }
        
       // Soluzione completa per il problema delle date

// Funzione per convertire una data in formato italiano (gg.mm.aa) a oggetto Date
function parseItalianDate(dateStr) {
    const [day, month, year] = dateStr.trim().split('.');
    return new Date(`20${year}`, parseInt(month) - 1, parseInt(day));
}

// Funzione corretta per generare il periodo mensile
function generateMonthlyPeriod() {
    const today = new Date();
    
    // Se ci sono entry storiche, prendiamo l'ultimo periodo e calcoliamo la data di inizio
    // come giorno successivo alla data di fine dell'ultimo periodo
    let startDate;
    
    if (historicalEntries.length > 0) {
        const lastPeriod = historicalEntries[historicalEntries.length - 1].periodo;
        // Estrai la data di fine (parte dopo "al ")
        const endDateStr = lastPeriod.split("al ")[1].trim();
        
        // Converti da formato italiano (gg.mm.aa) a Date
        const endDate = parseItalianDate(endDateStr);
        
        // La data di inizio è il giorno successivo
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() + 1);
    } else {
        // Se non ci sono entry storiche, prendiamo il primo giorno del mese corrente
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    
    // Data di fine è la data corrente
    const endDate = new Date(today);
    
    // Formattare le date
    const formattedStartDate = formatDate(startDate);
    const formattedEndDate = formatDate(endDate);
    
    return `dal ${formattedStartDate} al ${formattedEndDate}`;
}

// Funzione aggiuntiva per debugging che può aiutarti a verificare i periodi
function validateHistoricalPeriods() {
    if (historicalEntries.length <= 1) return true; // Non c'è abbastanza storia da validare
    
    let isValid = true;
    let errors = [];
    
    for (let i = 1; i < historicalEntries.length; i++) {
        const prevPeriod = historicalEntries[i-1].periodo;
        const currPeriod = historicalEntries[i].periodo;
        
        // Estrai le date di fine del periodo precedente
        const prevEndDateStr = prevPeriod.split("al ")[1].trim();
        const prevEndDate = parseItalianDate(prevEndDateStr);
        
        // Estrai la data di inizio del periodo corrente
        const currStartDateStr = currPeriod.split("dal ")[1].split(" al")[0].trim();
        const currStartDate = parseItalianDate(currStartDateStr);
        
        // Calcola la data che dovrebbe essere l'inizio del periodo corrente (giorno dopo la fine del precedente)
        const expectedStartDate = new Date(prevEndDate);
        expectedStartDate.setDate(expectedStartDate.getDate() + 1);
        
        // Verifica che la data di inizio corrente sia il giorno successivo alla fine del precedente
        if (currStartDate.getTime() !== expectedStartDate.getTime()) {
            isValid = false;
            errors.push(`Errore tra periodi ${i-1} e ${i}: ${formatDate(expectedStartDate)} != ${currStartDateStr}`);
        }
    }
    
    if (!isValid) {
        console.error("Errori nei periodi storici:", errors);
    }
    
    return isValid;
}

// Funzione per correggere manualmente i periodi storici
function fixHistoricalPeriods() {
    if (historicalEntries.length <= 0) return; // Nessun dato da correggere
    
    // Ordinare le entry per periodo (se necessario)
    // Le ordiniamo in base alla data di fine per assicurarci che siano cronologiche
    historicalEntries.sort((a, b) => {
        const dateA = parseItalianDate(a.periodo.split("al ")[1].trim());
        const dateB = parseItalianDate(b.periodo.split("al ")[1].trim());
        return dateA - dateB;
    });
    
    // Correzione dei periodi
    for (let i = 1; i < historicalEntries.length; i++) {
        const prevPeriod = historicalEntries[i-1].periodo;
        
        // Estrai la data di fine del periodo precedente
        const prevEndDateStr = prevPeriod.split("al ")[1].trim();
        const prevEndDate = parseItalianDate(prevEndDateStr);
        
        // La data di inizio corrente dovrebbe essere il giorno successivo
        const startDate = new Date(prevEndDate);
        startDate.setDate(startDate.getDate() + 1);
        
        // Estrai la data di fine del periodo corrente
        const endDateStr = historicalEntries[i].periodo.split("al ")[1].trim();
        const endDate = parseItalianDate(endDateStr);
        
        // Aggiorna il periodo con la data di inizio corretta
        historicalEntries[i].periodo = `dal ${formatDate(startDate)} al ${formatDate(endDate)}`;
    }
    
    // Salva le modifiche
    saveToLocalStorage();
    
    // Aggiorna l'interfaccia
    updateHistoricalTable();
    
    return {
        message: "Periodi corretti con successo",
        entries: historicalEntries
    };
}

// Funzione per correggere un database esistente (da chiamare da console)
function fixDatabase() {
    try {
        // Prima carichiamo i dati
        loadFromLocalStorage();
        
        // Correzione periodi
        const result = fixHistoricalPeriods();
        
        // Aggiorniamo tutto
        updateAll();
        
        return {
            success: true,
            message: "Database corretto con successo",
            result: result
        };
    } catch (error) {
        return {
            success: false,
            message: "Errore durante la correzione",
            error: error.message
        };
    }
}

function downloadTableBtn() {
    if (!chartData || chartData.length === 0) {
        showMessage('Nessun dato disponibile per la tabella!', 'error');
        return;
    }

    // Determina l'etichetta della prima colonna
    let firstColumnLabel = "Giorno";
    modeRadios.forEach(radio => {
        if (radio.checked) {
            if (radio.value === "giorno") {
                firstColumnLabel = "Giorno";
            } else if (radio.value === "area") {
                firstColumnLabel = "Area";
            } else if (radio.value === "custom") {
                firstColumnLabel = customLabelInput.value || "Codice";
            }
        }
    });

    // Prepara i dati CSV
    let csv = `${firstColumnLabel},Media Giornaliera (Fks),Valore (Fk Polo 18),Fk / Valore\n`;
    let sumFk = 0, sumValore = 0;

    chartData.forEach(item => {
        csv += `${item.identifier},${item.fk.toFixed(3)},${item.valore.toFixed(2)},${item.fk.toFixed(3)} / ${item.valore.toFixed(2)}\n`;
        sumFk += item.fk;
        sumValore += item.valore;
    });

    // Riga media
    const avgFk = sumFk / chartData.length;
    const avgValore = sumValore / chartData.length;
    csv += `Media,${avgFk.toFixed(3)},${avgValore.toFixed(2)},${avgFk.toFixed(3)} / ${avgValore.toFixed(2)}\n`;

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tabella_valori_${getCurrentDate().replace(/\./g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    showMessage('Tabella CSV scaricata con successo!', 'success');
}

        
// Funzione modificata per chiudere il mese
function closeMonth() {
    if (currentMonthEntries.length === 0) {
        showMessage('Non ci sono importi da registrare per questo mese!', 'error');
        return;
    }
    
    // Chiediamo input per le date tramite prompt del browser
    const startDateStr = prompt("Inserisci la data di inizio (formato GG.MM.AA):", "");
    if (!startDateStr) return; // L'utente ha annullato
    
    const endDateStr = prompt("Inserisci la data di fine (formato GG.MM.AA):", getCurrentDate());
    if (!endDateStr) return; // L'utente ha annullato
    
    // Verifica che le date siano nel formato corretto
    if (!isValidDateFormat(startDateStr) || !isValidDateFormat(endDateStr)) {
        showMessage('Il formato delle date deve essere GG.MM.AA!', 'error');
        return;
    }
    
    // Calcoliamo la media degli importi del mese corrente
    const totalMonthValue = calculateCurrentMonthValue();
    
    // Creiamo una nuova entry per lo storico
    const newHistoricalEntry = {
        periodo: `dal ${startDateStr} al ${endDateStr}`,
        importo: totalMonthValue
    };
    
    // Aggiungiamo l'entry allo storico
    historicalEntries.push(newHistoricalEntry);
    
    // Resettiamo gli importi del mese corrente
    currentMonthEntries = [];
    
    // Salviamo nel localStorage
    saveToLocalStorage();
    
    // Aggiorniamo l'interfaccia
    updateAll();
    
    showMessage('Mese chiuso con successo!', 'success');
}

// Funzione per verificare il formato della data
function isValidDateFormat(dateStr) {
    // Verifica che la data sia nel formato GG.MM.AA
    const regex = /^\d{2}\.\d{2}\.\d{2}$/;
    return regex.test(dateStr);
}

// Funzione per aggiungere un importo
function addImport() {
    const importInput = document.getElementById('importInput');
    const importo = parseFloat(importInput.value.replace(',', '.'));
    
    if (isNaN(importo) || importo <= 0) {
        showMessage('Inserisci un importo valido!', 'error');
        return;
    }
    
    // Aggiungiamo l'importo alla lista del mese corrente
    currentMonthEntries.push({
        data: getCurrentDate(),
        importo: importo
    });
    
    // Salviamo nel localStorage
    saveToLocalStorage();
    
    // Aggiorniamo l'interfaccia
    updateAll();
    
    // Puliamo l'input
    importInput.value = '';
    
    showMessage('Importo aggiunto con successo!', 'success');
}

// Funzione per eliminare l'ultimo dato inserito
function deleteLastEntry() {
    if (currentMonthEntries.length === 0) {
        showMessage('Non ci sono importi da cancellare!', 'error');
        return;
    }
    
    // Rimuoviamo l'ultimo elemento
    const removedEntry = currentMonthEntries.pop();
    
    // Salviamo nel localStorage
    saveToLocalStorage();
    
    // Aggiorniamo l'interfaccia
    updateAll();
    
    showMessage(`Ultimo importo (${formatImport(removedEntry.importo)}) cancellato con successo!`, 'success');
}

// Funzione per mostrare messaggi
function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.className = type; // 'error' o 'success'
    
    // Rimuoviamo il messaggio dopo 5 secondi
    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = '';
    }, 5000);
}

// Funzione aggiornata per esportare i dati
function scaricaDati() {
    const data = {
        currentMonthEntries,
        historicalEntries
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `trading_backup_${getCurrentDate().replace(/\./g, '-')}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    showMessage('Backup effettuato con successo!', 'success');
}

// Funzione per importare i dati
function caricaDati() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput.files.length === 0) {
        showMessage('Seleziona un file da caricare', 'error');
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.currentMonthEntries && data.historicalEntries) {
                currentMonthEntries = data.currentMonthEntries;
                historicalEntries = data.historicalEntries;
                
                // Salviamo nel localStorage
                saveToLocalStorage();
                
                // Aggiorniamo l'interfaccia
                updateAll();
                
                showMessage('Dati ripristinati con successo!', 'success');
            } else {
                showMessage('Il file di backup non è valido!', 'error');
            }
        } catch (err) {
            showMessage('Errore durante il caricamento del backup: ' + err.message, 'error');
        }
        
        // Reset del file input
        fileInput.value = '';
    };
    
    reader.readAsText(file);
}

// Funzione per aggiornare tutto
function updateAll() {
    updateCurrentMonthTable();
    updateHistoricalTable();
    updateDashboard();
}

// Event listener per aggiungere un importo
document.getElementById('addButton').addEventListener('click', addImport);

// Event listener per il tasto Invio nell'input
document.getElementById('importInput').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        addImport();
    }
});

// Funzione per creare il grafico
function createChart() {
    const canvas = document.getElementById('monthlyChart');
    const ctx = canvas.getContext('2d');
    
    // Pulire il canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (historicalEntries.length === 0) {
        // Messaggio se non ci sono dati
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Nessun dato storico disponibile', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    // Preparare i dati
    const values = historicalEntries.map(entry => parseFloat(entry.importo));
    const labels = historicalEntries.map(entry => entry.periodo.split('al ')[1].trim());
    
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;
    
    // Calcolare la media
    const averageValue = values.reduce((sum, value) => sum + value, 0) / values.length;
    
    // Configurazione del grafico
    const padding = 50;
    const chartWidth = canvas.width - (padding * 2);
    const chartHeight = canvas.height - (padding * 2);
    
    // Disegnare gli assi
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();
    
    // Disegnare la linea della media
    const averageY = canvas.height - padding - ((averageValue - minValue) / range) * chartHeight;
    ctx.strokeStyle = '#ff9800';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]); // Linea tratteggiata
    ctx.beginPath();
    ctx.moveTo(padding, averageY);
    ctx.lineTo(canvas.width - padding, averageY);
    ctx.stroke();
    ctx.setLineDash([]); // Ripristinare linea continua
    
    // Etichetta per la media
    ctx.fillStyle = '#ff9800';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Media: ${formatImport(averageValue)}`, canvas.width - padding - 100, averageY - 8);
    
    // Disegnare il grafico a linee
    if (values.length > 1) {
        ctx.strokeStyle = '#4caf50';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        values.forEach((value, index) => {
            const x = padding + (index * chartWidth) / (values.length - 1);
            const y = canvas.height - padding - ((value - minValue) / range) * chartHeight;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
    }
    
    // Disegnare i punti
    ctx.fillStyle = '#fff';
    values.forEach((value, index) => {
        const x = padding + (index * chartWidth) / Math.max(values.length - 1, 1);
        const y = canvas.height - padding - ((value - minValue) / range) * chartHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
        
        // Etichetta del valore
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(formatImport(value), x, y - 10);
        ctx.fillStyle = '#4caf50';
    });
    
    // Etichette sull'asse X
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    labels.forEach((label, index) => {
        const x = padding + (index * chartWidth) / Math.max(labels.length - 1, 1);
        ctx.fillText(label, x, canvas.height - 20);
    });
}

function createHighResChart() {
    // Creare un canvas temporaneo ad alta risoluzione
    const highResCanvas = document.createElement('canvas');
    const highResCtx = highResCanvas.getContext('2d');
    
    // Impostare le dimensioni ad alta risoluzione
    const width = 7680; // 1920 * 4
    const height = 4320; // 1080 * 4
    highResCanvas.width = width;
    highResCanvas.height = height;
    
    // Sfondo bianco
    highResCtx.fillStyle = '#ffffff';
    highResCtx.fillRect(0, 0, width, height);
    
    if (historicalEntries.length === 0) {
        // Messaggio se non ci sono dati
        highResCtx.fillStyle = '#666';
        highResCtx.font = 'bold 120px Arial';
        highResCtx.textAlign = 'center';
        highResCtx.fillText('Nessun dato storico disponibile', width / 2, height / 2);
        return highResCanvas;
    }
    
    // Preparare i dati
    const values = historicalEntries.map(entry => parseFloat(entry.importo));
    const labels = historicalEntries.map(entry => entry.periodo.split('al ')[1].trim());
    
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;
    
    // Calcolare la media
    const averageValue = values.reduce((sum, value) => sum + value, 0) / values.length;
    
    // Configurazione del grafico ad alta risoluzione
    const padding = 400;
    const chartWidth = width - (padding * 2);
    const chartHeight = height - (padding * 2);
    
    // Titolo
    highResCtx.fillStyle = '#333';
    highResCtx.font = 'bold 110px Arial';
    highResCtx.textAlign = 'center';
    highResCtx.fillText('Storico Mensilità di Trading', width / 2, 250);
    
    // Disegnare gli assi
    highResCtx.strokeStyle = '#333';
    highResCtx.lineWidth = 8;
    highResCtx.beginPath();
    highResCtx.moveTo(padding, padding);
    highResCtx.lineTo(padding, height - padding);
    highResCtx.lineTo(width - padding, height - padding);
    highResCtx.stroke();
    
    // Griglia
    highResCtx.strokeStyle = '#e0e0e0';
    highResCtx.lineWidth = 2;
    for (let i = 1; i < 10; i++) {
        const y = padding + (i * chartHeight) / 10;
        highResCtx.beginPath();
        highResCtx.moveTo(padding, y);
        highResCtx.lineTo(width - padding, y);
        highResCtx.stroke();
    }
    
    // Disegnare la linea della media
    const averageY = height - padding - ((averageValue - minValue) / range) * chartHeight;
    highResCtx.strokeStyle = '#ff9800';
    highResCtx.lineWidth = 8;
    highResCtx.setLineDash([20, 20]); // Linea tratteggiata ad alta risoluzione
    highResCtx.beginPath();
    highResCtx.moveTo(padding, averageY);
    highResCtx.lineTo(width - padding, averageY);
    highResCtx.stroke();
    highResCtx.setLineDash([]); // Ripristinare linea continua
    
    // Etichetta per la media
    highResCtx.fillStyle = '#ff9800';
    highResCtx.font = 'bold 60px Arial';
    highResCtx.textAlign = 'left';
    highResCtx.fillText(`Media: ${formatImport(averageValue)}`, width - padding - 600, averageY - 40);
    
    // Disegnare il grafico a linee
    if (values.length > 1) {
        highResCtx.strokeStyle = '#4caf50';
        highResCtx.lineWidth = 12;
        highResCtx.beginPath();
        
        values.forEach((value, index) => {
            const x = padding + (index * chartWidth) / (values.length - 1);
            const y = height - padding - ((value - minValue) / range) * chartHeight;
            
            if (index === 0) {
                highResCtx.moveTo(x, y);
            } else {
                highResCtx.lineTo(x, y);
            }
        });
        highResCtx.stroke();
    }
    
    // Disegnare i punti
    highResCtx.fillStyle = '#2e7d32';
    values.forEach((value, index) => {
        const x = padding + (index * chartWidth) / Math.max(values.length - 1, 1);
        const y = height - padding - ((value - minValue) / range) * chartHeight;
        
        highResCtx.beginPath();
        highResCtx.arc(x, y, 20, 0, 2 * Math.PI);
        highResCtx.fill();
        
        // Bordo bianco per i punti
        highResCtx.strokeStyle = '#fff';
        highResCtx.lineWidth = 6;
        highResCtx.stroke();
        
        // Etichetta del valore
        highResCtx.fillStyle = '#333';
        highResCtx.font = 'bold 60px Arial';
        highResCtx.textAlign = 'center';
        highResCtx.fillText(formatImport(value), x, y - 60);
    });
    
    // Etichette sull'asse X
    highResCtx.fillStyle = '#333';
    highResCtx.font = 'bold 50px Arial';
    highResCtx.textAlign = 'center';
    labels.forEach((label, index) => {
        const x = padding + (index * chartWidth) / Math.max(labels.length - 1, 1);
        highResCtx.fillText(label, x, height - 150);
    });
    
    // Etichette sull'asse Y
    highResCtx.textAlign = 'right';
    for (let i = 0; i <= 10; i++) {
        const value = minValue + (range * i) / 10;
        const y = height - padding - (i * chartHeight) / 10;
        highResCtx.fillText(formatImport(value), padding - 50, y + 20);
    }
    
    return highResCanvas;
}


// Funzione per scaricare il grafico
function downloadChart() {
    const highResCanvas = createHighResChart();
    const link = document.createElement('a');
    link.download = `grafico_storico_HR_${getCurrentDate().replace(/\./g, '-')}.png`;
    link.href = highResCanvas.toDataURL('image/png');
    link.click();
    showMessage('Grafico ad alta risoluzione scaricato con successo!', 'success');
}


// Funzione per scaricare la tabella storico in CSV
function downloadHistoricalTable() {
    if (historicalEntries.length === 0) {
        showMessage('Non ci sono dati storici da scaricare!', 'error');
        return;
    }
    const htmlContent = generateEditableTableHTML();
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `storico_mensile_editabile_${getCurrentDate().replace(/\./g, '-')}.html`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showMessage('Tabella HTML editabile scaricata con successo!', 'success');
}

// Scarica sia la tabella Importi Mese Corrente sia la tabella Storico Mensile in un unico file HTML
function downloadCombinedTablesHTML() {
    if (currentMonthEntries.length === 0 && historicalEntries.length === 0) {
        showMessage('Non ci sono dati da scaricare!', 'error');
        return;
    }

    // Tabella Importi Mese Corrente
    let currentMonthTableHTML = `
        <h3>Importi Mese Corrente</h3>
        <div style="overflow-x: auto;">
            <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Importo (€)</th>
                    </tr>
                </thead>
                <tbody>
    `;
    currentMonthEntries.forEach(entry => {
        currentMonthTableHTML += `
            <tr>
                <td>${entry.data}</td>
                <td>${formatImport(entry.importo)}</td>
            </tr>
        `;
    });
    currentMonthTableHTML += `
                </tbody>
            </table>
        </div>
    `;

    // Tabella Storico Mensile
    let historicalTableHTML = `
        <h3>Storico Mensile</h3>
        <div style="overflow-x: auto;">
            <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                <thead>
                    <tr>
                        <th>Periodo</th>
                        <th>Importo (€)</th>
                    </tr>
                </thead>
                <tbody>
    `;
    historicalEntries.forEach(entry => {
        historicalTableHTML += `
            <tr>
                <td>${entry.periodo}</td>
                <td>${formatImport(entry.importo)}</td>
            </tr>
        `;
    });
    // Calcola il totale storico
    const total = historicalEntries.reduce((sum, entry) => sum + parseFloat(entry.importo), 0);
    historicalTableHTML += `
            <tr style="font-weight:bold; background:#eef;">
                <td>TOTALE</td>
                <td>${formatImport(total)}</td>
            </tr>
        </tbody>
    </table>
    </div>
    `;

    // Unisci le due tabelle in un unico HTML
    const combinedHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Storico e Importi Mese Corrente</title>
</head>
<body>
    ${currentMonthTableHTML}
    <br><br>
    ${historicalTableHTML}
</body>
</html>
    `;

    // Download
    const blob = new Blob([combinedHTML], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `importi_e_storico_${getCurrentDate().replace(/\./g, '-')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    showMessage('Tabelle HTML scaricate con successo!', 'success');
}



// Event listener per cancellare l'ultimo dato
document.getElementById('deleteLastButton').addEventListener('click', deleteLastEntry);

// Event listener per chiudere il mese
document.getElementById('closeMonthButton').addEventListener('click', closeMonth);

// Event listener per scarica dati
document.getElementById('scaricaDatiBtn').addEventListener('click', scaricaDati);

// Event listener per carica dati
document.getElementById('caricaDatiBtn').addEventListener('click', caricaDati);

// Stilizzazione del file input per migliorare l'esperienza utente
document.getElementById('fileInput').addEventListener('change', function() {
    const fileName = this.files[0]?.name;
    if (fileName) {
        this.nextElementSibling.textContent = fileName;
    } else {
        this.nextElementSibling.textContent = 'Seleziona File';
    }
});

// Carichiamo i dati dal localStorage all'avvio
loadFromLocalStorage();

// Inizializzazione dell'applicazione
updateAll();

// Event listener per scaricare il grafico
document.getElementById('downloadChartBtn').addEventListener('click', downloadChart);

// Event listener per scaricare la tabella storico
document.getElementById('downloadTableBtn').addEventListener('click', downloadCombinedTablesHTML);




// Aggiornare la funzione updateAll esistente per includere il grafico
function updateAll() {
    updateCurrentMonthTable();
    updateHistoricalTable();
    updateDashboard();
    createChart(); // Aggiungi questa riga
}


// =========== FINE =========== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---




// 2. trade.js - PAGINA TRADE ATTIVI ---

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
            currentPrice = await getPriceFromCoinGecko(trade.symbol);
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



// =========== FINE =========== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---







// 3. panoramica.js - PAGINA PANORAMICA ---

// Dati principali dell'applicazione
  const datiCapitale = {
  totaleIn: 0,
  capitale: 0,
  totaleTrade: 30,
  quotaPerTrade: 0,
  storicoCapitale: [],
  ultimoAggiornamento: new Date().toISOString()

};

  
  // Variabili per i grafici
  let capitaleChart = null;
  let storicoCapitaleChart = null;
  let percentualeCapitaleChart = null;
  let periodoVisualizzato = 30; // default: 30 giorni
  
  // Funzione di inizializzazione
  function inizializza() {
    // Carica dati salvati se disponibili
    caricaDatiLocali();
    
    // Se non ci sono dati storici, crea un punto iniziale
    if (datiCapitale.storicoCapitale.length === 0) {
      creaStoricoIniziale();
    }
    
    // Aggiorna l'interfaccia con i dati attuali
    aggiornaInterfaccia();
    
    // Crea il grafico iniziale
    creaGraficoCapitale();
    
    // Crea il grafico storico
    creaGraficoStoricoCapitale();
    
    // Crea il grafico percentuale
    creaGraficoPercentualeCapitale();
    
    // Calcola e mostra le statistiche sulla percentuale di tempo
    calcolaStatistichePercentuali();
  }
  
  // Crea uno storico iniziale con valori di default retroattivi
  function creaStoricoIniziale() {
    const oggi = new Date();
    const inizioStorico = new Date(oggi);
    inizioStorico.setDate(oggi.getDate() - 120); // Crea uno storico di 4 mesi
    
    // Valori di default per lo storico iniziale
   const valoriDefault = {
  totaleIn: 0,
  capitale: datiCapitale.totaleTrade
};

for (let d = new Date(inizioStorico); d <= oggi; d.setDate(d.getDate() + 3)) {
  datiCapitale.storicoCapitale.push({
    data: new Date(d).toISOString(),
    totaleIn: valoriDefault.totaleIn,
    capitale: valoriDefault.capitale
  });
}

datiCapitale.storicoCapitale.push({
  data: new Date().toISOString(),
  totaleIn: datiCapitale.totaleIn,
  capitale: datiCapitale.capitale
});
}
  
  // Aggiorna i totali
  function aggiornaTotali() {
    datiCapitale.quotaPerTrade = parseFloat(document.getElementById("quotaPerTrade").value) || datiCapitale.quotaPerTrade;
    
    // Aggiorna l'interfaccia
    aggiornaInterfaccia();
    
    // Salva lo stato nei dati storici
    salvaStorico();
    
    // Salva i dati in localStorage
    salvaDatiLocali();
    
    // Aggiorna i grafici
   // aggiornaGrafico();
    aggiornaGraficoStorico();
    aggiornaGraficoPercentuale();
    
    // Ricalcola le statistiche percentuali
    calcolaStatistichePercentuali();
  }
  
  // Funzione per resettare tutti i dati
function resettaDati() {
  datiCapitale.totaleIn = 0;
  datiCapitale.capitale = datiCapitale.totaleTrade;
  datiCapitale.storicoCapitale = [];
  datiCapitale.ultimoAggiornamento = new Date().toISOString();

  creaStoricoIniziale();
  aggiornaInterfaccia();
  aggiornaGraficoStorico();
  aggiornaGraficoPercentuale();
  calcolaStatistichePercentuali();
  salvaDatiLocali();

  alert('Dati resettati con successo!');
}


// Salva immagine del grafico
function scaricaGrafico() {
  const canvas = document.getElementById('storicoCapitaleChart');
  
  // Attiva modalità export e ricrea il grafico
  modalitaExport = true;
  creaGraficoStoricoCapitale();
  
  // Aspetta che il grafico sia completamente renderizzato
  setTimeout(() => {
    // Crea un canvas temporaneo con proporzioni più ampie (16:9)
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // Imposta dimensioni HD con rapporto 16:9
    tempCanvas.width = 4260;
    tempCanvas.height = 2160;
    
    // Riempie lo sfondo di BIANCO
    tempCtx.fillStyle = '#FFFFFF';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Copia il grafico originale sul canvas temporaneo
    tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
    
    // Aggiungi il watermark
    aggiungiWatermark(tempCtx, tempCanvas.width, tempCanvas.height);
    
    // Crea il link per il download
    const link = document.createElement('a');
    const oggi = new Date();
    const dataFormattata = oggi.toISOString().split('T')[0];
    
    link.download = `grafico-capitale-HD-${dataFormattata}.png`;
    link.href = tempCanvas.toDataURL('image/png', 1.0);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Disattiva modalità export e ricrea il grafico per la visualizzazione web
    modalitaExport = false;
    creaGraficoStoricoCapitale();
  }, 100); // Piccolo delay per assicurarsi che il rendering sia completo
}


  
 // 2. Modifica la funzione aggiornaTrade() 
function aggiornaTrade() {
    const nuovoTotaleIn = parseInt(document.getElementById("inputTotaleIn").value);
    
    if (!isNaN(nuovoTotaleIn)) {
      datiCapitale.totaleIn = nuovoTotaleIn;
      
    }
    
    // Aggiorna il capitale disponibile
    calcolaCapitale();
    
    // Aggiorna l'ultimo aggiornamento
    datiCapitale.ultimoAggiornamento = new Date().toISOString();
    
    // Aggiorna l'interfaccia
    aggiornaInterfaccia();
    
    // Salva lo stato nei dati storici
    salvaStorico();
    
    // Salva i dati in localStorage
    salvaDatiLocali();
    
    // Aggiorna i grafici
    aggiornaGraficoStorico();
    aggiornaGraficoPercentuale();
    
    // Ricalcola le statistiche percentuali
    calcolaStatistichePercentuali();
    
    setTimeout(() => {
      salvaDatiLocali();
      aggiornaGraficoStorico();
    }, 100);
}


  // Calcola il capitale disponibile
  function calcolaCapitale() {
    datiCapitale.capitale = datiCapitale.totaleTrade - datiCapitale.totaleIn;
  }
  
  function verificaDatiStorico() {
  console.log('Dati storico attuali:', datiCapitale.storicoCapitale);
  console.log('Ultimo aggiornamento:', datiCapitale.ultimoAggiornamento);
  console.log('LocalStorage:', JSON.parse(localStorage.getItem('datiCapitale')));
}

 // 1. Modifica la funzione aggiornaInterfaccia()
function aggiornaInterfaccia() {
    document.getElementById("totaleIn").textContent = datiCapitale.totaleIn;
    document.getElementById("capitale").textContent = datiCapitale.capitale;
    document.getElementById("totaleTrade").textContent = datiCapitale.totaleTrade;
    document.getElementById("infoTotaleTrade").textContent = datiCapitale.totaleTrade;
    document.getElementById("quotaPerTrade").value = datiCapitale.quotaPerTrade;
    
    // Aggiorna il valore dell'input (ora solo uno)
    document.getElementById("inputTotaleIn").value = datiCapitale.totaleIn;
    
    // Calcola e aggiorna i nuovi valori in dollari
    const capitaleTotale = datiCapitale.totaleTrade * datiCapitale.quotaPerTrade;
    const capitaleInDollari = datiCapitale.capitale * datiCapitale.quotaPerTrade;
    const totaleInDollari = datiCapitale.totaleIn * datiCapitale.quotaPerTrade;
    
    // Aggiorna i nuovi elementi dell'interfaccia
    document.getElementById('capitaleTotale').innerText = capitaleTotale;
    document.getElementById('capitaleInDollari').innerText = `$${capitaleInDollari}`;
    document.getElementById('totaleInDollari').innerText = `$${totaleInDollari}`;
    
    // Calcola e aggiorna le medie (modificato per il totale unico)
    const datiPeriodo = filtraDatiPerPeriodo(datiCapitale.storicoCapitale, periodoVisualizzato);
    
    if (datiPeriodo.length > 0) {
      const mediaTotaleIn = calcolaMedia(datiPeriodo.map(item => item.totaleIn));
      const mediaDollari = mediaTotaleIn * datiCapitale.quotaPerTrade;
      
      document.getElementById("mediaTradeTotaleIn").textContent = mediaTotaleIn.toFixed(1);
      document.getElementById("mediaDollariTrading").textContent = `$${mediaDollari.toFixed(2)}`;
    }
}

  
  // Calcola la media di un array di numeri
  function calcolaMedia(array) {
    if (array.length === 0) return 0;
    return array.reduce((sum, val) => sum + val, 0) / array.length;
  }
  
 // Salva lo stato attuale nei dati storici
 function salvaStorico() {
  const oggi = new Date();
  const oggiString = oggi.toISOString().split('T')[0];
  const recordOggi = datiCapitale.storicoCapitale.find(record => 
    record.data.split('T')[0] === oggiString
  );

  if (recordOggi) {
    // Aggiorna il record esistente per oggi
    recordOggi.totaleIn = datiCapitale.totaleIn;
    recordOggi.capitale = datiCapitale.capitale;
  } else {
    // Aggiungi un nuovo record solo se non esiste già
    datiCapitale.storicoCapitale.push({
      data: oggi.toISOString(),
      totaleIn: datiCapitale.totaleIn,
      capitale: datiCapitale.capitale
    });
}


  
  // Ordina lo storico per data
  datiCapitale.storicoCapitale.sort((a, b) => new Date(a.data) - new Date(b.data));
}
  
  // Filtra i dati storici per il periodo visualizzato
  function filtraDatiPerPeriodo(dati, giorni) {
    if (!dati || dati.length === 0) return [];
    
    if (giorni === 'all') return dati;
    
    const oggi = new Date();
    const dataLimite = new Date(oggi);
    dataLimite.setDate(oggi.getDate() - giorni);
    
    return dati.filter(item => new Date(item.data) >= dataLimite);
  }
  
 // 5. Modifica la funzione creaGraficoCapitale() per il grafico a torta
function creaGraficoCapitale() {
  const ctx = document.getElementById('capitaleChart').getContext('2d');

  if (capitaleChart) {
    capitaleChart.destroy();
  }

  capitaleChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Totale In (Crypto)', 'A Capitale (USD)'],
      datasets: [{
        data: [
          datiCapitale.totaleIn,
          datiCapitale.capitale
        ],
        backgroundColor: [
          '#F62817',
          '#1AA6ED'
        ],
        borderColor: '#222',
        borderWidth: 1,
        hoverOffset: 22
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#c3c3c3',
            font: {
              size: 15,
              family: 'Trebuchet MS'
            },
            padding: 8,
            boxWidth: 15,
            boxHeight: 15,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: '#181c23',
          titleColor: '#739bf2',
          bodyColor: '#F0F8FF',
          borderColor: '#2980b9',
          borderWidth: 2,
          cornerRadius: 10,
          padding: 18,
          displayColors: true,
          bodyFont: {
            size: 18
          },
          callbacks: {
            label: function (context) {
              const label = context.label || '';
              const value = context.raw || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              const dollari = (value * datiCapitale.quotaPerTrade).toFixed(2);
              return `${label}: ${value} trade (${percentage}%) = $${dollari}`;
            }
          }
        }
      },
      cutout: '45%',
      layout: {
        padding: 18
      }
    }
  });
}

// Funzione per scaricare il grafico percentuale
// Funzione per scaricare il grafico percentuale con dimensioni HD e sfondo bianco
function scaricaGraficoPercentuale1() {
  console.log('Funzione scaricaGraficoPercentuale chiamata'); // Debug
  
  // Verifica che la variabile del grafico esista
  if (typeof percentualeCapitaleChart === 'undefined' || !percentualeCapitaleChart) {
    console.error('Grafico percentualeCapitaleChart non trovato - assicurati che sia stato creato');
    alert('Grafico non disponibile per il download. Assicurati che il grafico sia visualizzato.');
    return;
  }
  
  try {
    // Crea un canvas temporaneo con proporzioni più ampie (16:9)
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // Imposta dimensioni HD con rapporto 16:9
    tempCanvas.width = 4260;
    tempCanvas.height = 2160;
    
    // Riempie lo sfondo di BIANCO
    tempCtx.fillStyle = '#FFFFFF';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Ottieni l'immagine del grafico originale
    const chartImageUrl = percentualeCapitaleChart.toBase64Image('image/png', 1.0);
    
    // Crea un'immagine temporanea per disegnare sul canvas
    const img = new Image();
    img.onload = function() {
      // Disegna l'immagine del grafico sul canvas temporaneo
      tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
      
      // Aggiungi il watermark se la funzione esiste
      if (typeof aggiungiWatermark === 'function') {
        aggiungiWatermark(tempCtx, tempCanvas.width, tempCanvas.height);
      }
      
      // Crea il link per il download
      const link = document.createElement('a');
      const oggi = new Date();
      const dataFormattata = oggi.toISOString().split('T')[0];
      
      link.download = `grafico-percentuale-capitale-HD-${dataFormattata}.png`;
      link.href = tempCanvas.toDataURL('image/png', 1.0);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('Download completato');
    };
    
    img.onerror = function() {
      console.error('Errore nel caricamento dell\'immagine del grafico');
      alert('Errore nel caricamento dell\'immagine del grafico');
    };
    
    // Carica l'immagine del grafico
    img.src = chartImageUrl;
    
  } catch (error) {
    console.error('Errore durante il download:', error);
    alert('Errore durante il download del grafico: ' + error.message);
  }
}
// NOTA: Nel tuo codice creaGraficoPercentualeCapitale() c'è un errore:
// Cambia "borderColor: 2," in "borderColor: '#3498db'," o un altro colore valido

// Pulsante HTML da aggiungere nella sezione del grafico percentuale
/*
<button onclick="scaricaGraficoPercentuale()" class="btn btn-secondary">
  <i class="fas fa-download"></i> Scarica Grafico Percentuale
</button>
*/

// Funzione per scaricare il grafico percentuale
function scaricaGraficoPercentuale() {
  const canvas = document.getElementById('percentualeCapitaleChart');
  
  // Attiva modalità export e ricrea il grafico
  modalitaExport = true;
  creaGraficoPercentualeCapitale();
  
  // Aspetta che il grafico sia completamente renderizzato
  setTimeout(() => {
    // Crea un canvas temporaneo con proporzioni più ampie (16:9)
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // Imposta dimensioni HD con rapporto 16:9
    tempCanvas.width = 4260;
    tempCanvas.height = 2160;
    
    // Riempie lo sfondo di BIANCO
    tempCtx.fillStyle = '#FFFFFF';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Copia il grafico originale sul canvas temporaneo
    tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
    
    // Aggiungi il watermark
    aggiungiWatermark(tempCtx, tempCanvas.width, tempCanvas.height);
    
    // Crea il link per il download
    const link = document.createElement('a');
    const oggi = new Date();
    const dataFormattata = oggi.toISOString().split('T')[0];
    
    link.download = `grafico-percentuale-capitale-HD-${dataFormattata}.png`;
    link.href = tempCanvas.toDataURL('image/png', 1.0);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Disattiva modalità export e ricrea il grafico per la visualizzazione web
    modalitaExport = false;
    creaGraficoPercentualeCapitale();
  }, 100); // Piccolo delay per assicurarsi che il rendering sia completo
}
  
  // Crea il grafico storico della distribuzione del capitale
  // Configurazione colori per web e export
const coloriConfig = {
  web: {
    testo: '#fff',
    griglia: 'rgba(68, 68, 68, 0.8)',
    sfondo: 'transparent'
  },
  export: {
    testo: '#000',
    griglia: 'rgba(200, 200, 200, 0.8)',
    sfondo: '#ffffff'
  }
};

let modalitaExport = false; // Flag per sapere se stiamo esportando

// 3. Modifica la funzione creaGraficoStoricoCapitale() per mostrare solo due linee
function creaGraficoStoricoCapitale() {
  const canvas = document.getElementById('storicoCapitaleChart');
  const ctx = canvas.getContext('2d');

  const datiPeriodo = filtraDatiPerPeriodo(datiCapitale.storicoCapitale, periodoVisualizzato);

  if (storicoCapitaleChart) {
    storicoCapitaleChart.destroy();
  }

  // Scegli i colori in base alla modalità
  const colori = modalitaExport ? coloriConfig.export : coloriConfig.web;

  storicoCapitaleChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: datiPeriodo.map(item => {
        const data = new Date(item.data);
        return `${data.getDate()}/${data.getMonth() + 1}`;
      }),
      datasets: [
        {
          label: 'Totale In (Crypto)',
          data: datiPeriodo.map(item => item.totaleIn),
          backgroundColor: 'rgba(246, 40, 23, 0.2)',
          borderColor: '#F62817',
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Capitale (USD)',
          data: datiPeriodo.map(item => item.capitale),
          backgroundColor: 'rgba(0, 128, 128, 0.2)',
          borderColor: '#1AA6ED',
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      
      interaction: {
        mode: 'index',
        intersect: false
      },
      hover: {
        mode: 'index',
        intersect: false,
        animationDuration: 300
      },
      animation: {
        duration: modalitaExport ? 0 : 800,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: colori.testo,
            font: {
              size: 14,
              family: 'Poppins, Arial, sans-serif'
            },
            padding: 15,
            boxWidth: 25,
            boxHeight: 12,
            usePointStyle: false
          }
        },
        tooltip: {
          enabled: !modalitaExport,
          backgroundColor: 'rgba(51, 51, 51, 0.95)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#666',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: function(context) {
              const label = context.dataset.label || '';
              const value = context.parsed.y || 0;
              return `${label}: ${value.toFixed(2)}`;
            }
          }
        }
      },
      layout: {
        padding: {
          top: modalitaExport ? 2 : 5,
          right: modalitaExport ? 5 : 10,
          bottom: modalitaExport ? 2 : 5,
          left: modalitaExport ? 5 : 5
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 30,
          title: {
            display: true,
            text: 'Numero di Trade',
            color: colori.testo,
            font: {
              size: modalitaExport ? 14.5 : 12
            }
          },
          ticks: {
            color: colori.testo,
            font: {
              size: modalitaExport ? 14.5 : 12
            }
          },
          grid: {
            color: colori.griglia
          }
        },
        x: {
          title: {
            display: true,
            text: 'Data',
            color: colori.testo,
            font: {
              size: modalitaExport ? 14.5 : 12
            }
          },
          ticks: {
            color: colori.testo,
            font: {
              size: modalitaExport ? 14.5 : 12
            },
            maxRotation: 45,
            minRotation: 0
          },
          grid: {
            color: colori.griglia
          }
        }
      }
    }
  });
}


// Funzione per aggiungere watermark al canvas
function aggiungiWatermark(ctx, width, height) {
  const oggi = new Date();
  const dataFormattata = oggi.toLocaleDateString('it-IT');
  
  // Salva il contesto corrente
  ctx.save();
  
  // Configura il testo del watermark
  ctx.font = '34px "Courier New", monospace';
  ctx.fillStyle = '#666666';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  
  // Testo del watermark
  const watermarkText = `📈 gerardo_dorrico data: ${dataFormattata}`;
  
  // Posiziona il watermark in basso a destra
  const padding = 30;
  ctx.fillText(watermarkText, width - padding, height - padding);
  
  // Ripristina il contesto
  ctx.restore();
}



  
 // 4. Modifica la funzione aggiornaGraficoStorico()
function aggiornaGraficoStorico() {
    if (storicoCapitaleChart) {
      const datiPeriodo = filtraDatiPerPeriodo(datiCapitale.storicoCapitale, periodoVisualizzato);
      
      storicoCapitaleChart.data.labels = datiPeriodo.map(item => {
        const data = new Date(item.data);
        return `${data.getDate()}/${data.getMonth() + 1}`;
      });
      
      // Solo due dataset ora
      storicoCapitaleChart.data.datasets[0].data = datiPeriodo.map(item => item.totaleIn);
      storicoCapitaleChart.data.datasets[1].data = datiPeriodo.map(item => item.capitale);
      
      storicoCapitaleChart.update();
    }
}


  // Cambia il range di tempo visualizzato
  function cambiaRangeTempo(elemento) {
    // Rimuovi la classe active da tutti i bottoni
    document.querySelectorAll('.time-range-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Aggiungi la classe active all'elemento cliccato
    elemento.classList.add('active');
    
    // Aggiorna il periodo visualizzato
    periodoVisualizzato = elemento.dataset.days;
    
    // Aggiorna i grafici
    aggiornaGraficoStorico();
    aggiornaGraficoPercentuale();
    
    // Aggiorna le statistiche
    aggiornaInterfaccia();
    
    // Ricalcola le statistiche percentuali
    calcolaStatistichePercentuali();
  }
  
  // Cambia tab attivo
  function cambiaTab(event, tabId) {
    // Nascondi tutti i pannelli
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    
    // Rimuovi active da tutti i bottoni
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Mostra il pannello selezionato
    document.getElementById(tabId).classList.add('active');
    
    // Attiva il bottone cliccato
    event.currentTarget.classList.add('active');
    
    // Aggiorna i grafici se necessario
    if (tabId === 'tab-distribuzione') {
      aggiornaGraficoStorico();
    } else if (tabId === 'tab-percentuale') {
      aggiornaGraficoPercentuale();
      calcolaStatistichePercentuali();
    }
  }
  
  // Crea il grafico percentuale
  function creaGraficoPercentualeCapitale() {
    const ctx = document.getElementById('percentualeCapitaleChart').getContext('2d');
    const datiPeriodo = filtraDatiPerPeriodo(datiCapitale.storicoCapitale, periodoVisualizzato);
    
    // Calcola le percentuali del capitale in dollari
    const percentuali = datiPeriodo.map(item => {
      const totaleInDollari = item.totaleIn * datiCapitale.quotaPerTrade;
      const totaleComplessivo = datiCapitale.totaleTrade * datiCapitale.quotaPerTrade;
      return (totaleInDollari / totaleComplessivo) * 100;
    });
    
    percentualeCapitaleChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: datiPeriodo.map(item => {
          const data = new Date(item.data);
          return `${data.getDate()}/${data.getMonth() + 1}`;
        }),
        datasets: [{
          label: '% Capitale in Trading',
          data: percentuali,
          backgroundColor: 'rgba(213, 240, 255, 0.4)',
          borderColor: 'rgba(0,65,194, 1)',
          tension: 0.4,
          fill: true,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Percentuale in Trading (%)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Data'
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.raw || 0;
                return `Capitale in Trading: ${value.toFixed(1)}%`;
              }
            }
          }
        }
      }
    });
  }
  
  // Aggiorna il grafico percentuale
  function aggiornaGraficoPercentuale() {
    if (percentualeCapitaleChart) {
      const datiPeriodo = filtraDatiPerPeriodo(datiCapitale.storicoCapitale, periodoVisualizzato);
      
      // Aggiorna le etichette
      percentualeCapitaleChart.data.labels = datiPeriodo.map(item => {
        const data = new Date(item.data);
        return `${data.getDate()}/${data.getMonth() + 1}`;
      });
      
      // Calcola le nuove percentuali
      const percentuali = datiPeriodo.map(item => {
        const totaleInDollari = item.totaleIn * datiCapitale.quotaPerTrade;
        const totaleComplessivo = datiCapitale.totaleTrade * datiCapitale.quotaPerTrade;
        return (totaleInDollari / totaleComplessivo) * 100;
      });
      
      percentualeCapitaleChart.data.datasets[0].data = percentuali;
      percentualeCapitaleChart.update();
    }
  }
  
  // Calcola le statistiche per le percentuali di tempo
  function calcolaStatistichePercentuali() {
    const datiPeriodo = filtraDatiPerPeriodo(datiCapitale.storicoCapitale, periodoVisualizzato);
    
    if (datiPeriodo.length === 0) {
      return;
    }
    
    // Contatori per ciascuna fascia percentuale
    let count0_25 = 0;
    let count25_50 = 0;
    let count50_75 = 0;
    let count75_100 = 0;
    
    // Calcola le percentuali per ogni giorno e incrementa i contatori
    datiPeriodo.forEach(item => {
      const totaleInDollari = item.totaleIn * datiCapitale.quotaPerTrade;
      const totaleComplessivo = datiCapitale.totaleTrade * datiCapitale.quotaPerTrade;
      const percentuale = (totaleInDollari / totaleComplessivo) * 100;
      
      if (percentuale <= 25) {
        count0_25++;
      } else if (percentuale <= 50) {
        count25_50++;
      } else if (percentuale <= 75) {
        count50_75++;
      } else {
        count75_100++;
      }
    });
    
    // Aggiorna i contatori nell'interfaccia
    document.getElementById("percentuale0_25").textContent = `${count0_25} giorni`;
    document.getElementById("percentuale25_50").textContent = `${count25_50} giorni`;
    document.getElementById("percentuale50_75").textContent = `${count50_75} giorni`;
    document.getElementById("percentuale75_100").textContent = `${count75_100} giorni`;
  }
  
	// Totale del Capitale
   function aggiornaCapitale() {
    // Recupera il valore dei "Trade Totali"
    const tradeTotali = parseInt(document.getElementById('totaleTrade').innerText);

    // Recupera il valore della "Quota per Trade"
    const quotaPerTrade = parseInt(document.getElementById('quotaPerTrade').value);

    // Salva il valore quotaPerTrade nei dati principali
    datiCapitale.quotaPerTrade = quotaPerTrade;

    // Calcola il "Capitale Totale"
    const capitaleTotale = tradeTotali * quotaPerTrade;

    // Calcola "A Capitale" in dollari
    const capitaleInDollari = datiCapitale.capitale * quotaPerTrade;

    // Calcola "Totale In" in dollari
    const totaleInDollari = datiCapitale.totaleIn * quotaPerTrade;

    // Aggiorna tutti i valori nell'interfaccia
    document.getElementById('capitaleTotale').innerText = capitaleTotale;
    document.getElementById('capitaleInDollari').innerText = `$${capitaleInDollari}`;
    document.getElementById('totaleInDollari').innerText = `$${totaleInDollari}`;

    // Salva i dati aggiornati
    salvaDatiLocali();
}



// Modifica la funzione aggiornaTotali() per salvare quotaPerTrade
function aggiornaTotali() {
    datiCapitale.quotaPerTrade = parseFloat(document.getElementById("quotaPerTrade").value) || datiCapitale.quotaPerTrade;
    
    // Aggiorna l'interfaccia
    aggiornaInterfaccia();
    
    // Salva lo stato nei dati storici
    salvaStorico();
    
    // Salva i dati in localStorage
    salvaDatiLocali();
    
    // Aggiorna i grafici
   // aggiornaGrafico();
    aggiornaGraficoStorico();
    aggiornaGraficoPercentuale();
    
    // Ricalcola le statistiche percentuali
    calcolaStatistichePercentuali();
}


  // Salva i dati in localStorage
  function salvaDatiLocali() {
    localStorage.setItem('datiCapitale', JSON.stringify(datiCapitale));
  }
  
  // Carica i dati da localStorage
  function caricaDatiLocali() {
  const datiSalvati = localStorage.getItem('datiCapitale');
  if (datiSalvati) {
    const datiCaricati = JSON.parse(datiSalvati);
    if (!datiCaricati.hasOwnProperty('totaleIn') || !datiCaricati.hasOwnProperty('capitale')) {
      alert('Il file non contiene dati validi.');
      return;
    }
    Object.assign(datiCapitale, datiCaricati);
  }
}


  
  // Scarica i dati come file JSON
  function scaricaDati() {
    const dataStr = JSON.stringify(datiCapitale, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const a = document.createElement('a');
    a.href = url;
	
    a.download = `capitale-trading-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  // Carica i dati da un file JSON
  function caricaDati() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
      alert('Seleziona un file JSON prima di procedere.');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const datiCaricati = JSON.parse(e.target.result);
        
        // Verifica che i dati caricati abbiano la struttura corretta
        if (!datiCaricati.hasOwnProperty('totaleIn') || 
            !datiCaricati.hasOwnProperty('capitale')) {
          alert('Il file non contiene dati validi.');
          return;
        }
        
        // Aggiorna i dati dell'applicazione
        Object.assign(datiCapitale, datiCaricati);
        
        // Aggiorna l'interfaccia
        aggiornaInterfaccia();
        
        // Aggiorna i grafici
       // aggiornaGrafico();
        aggiornaGraficoStorico();
        aggiornaGraficoPercentuale();
        
        // Ricalcola le statistiche percentuali
        calcolaStatistichePercentuali();
        
        // Salva i dati in localStorage
        salvaDatiLocali();
     
        alert('Dati caricati con successo!');
      } catch (error) {
        alert('Errore durante il caricamento dei dati: ' + error.message);
      }
    };
    
    reader.readAsText(file);
  }
  
  // Funzione per aggiungere un indicatore del tempo del capitale
  function aggiungiIndicatoreTempo() {
    // Ottieni i dati più recenti
    const datiRecenti = filtraDatiPerPeriodo(datiCapitale.storicoCapitale, 30); // ultimi 30 giorni
    
    if (datiRecenti.length < 2) return; // Servono almeno 2 punti dati per calcolare una tendenza
    
    // Calcola il trend del capitale in trading
    const primoValore = datiRecenti[0].totaleIn;
    const ultimoValore = datiRecenti[datiRecenti.length - 1].totaleIn;
    const differenza = ultimoValore - primoValore;
    
    // Calcola la velocità media di variazione (trade al giorno)
    const giorniPassati = (new Date(datiRecenti[datiRecenti.length - 1].data) - new Date(datiRecenti[0].data)) / (1000 * 60 * 60 * 24);
    const velocitaMediaGiornaliera = giorniPassati > 0 ? differenza / giorniPassati : 0;
    
    // Calcola il tempo stimato per raggiungere il 100% o tornare allo 0% del capitale in trading
    let tempoStimato = 0;
    let messaggio = "";
    
    if (velocitaMediaGiornaliera > 0) {
      // Stiamo aumentando il capitale in trading, calcoliamo quanto tempo per arrivare al 100%
      const tradeRimanenti = datiCapitale.totaleTrade - ultimoValore;
      tempoStimato = velocitaMediaGiornaliera > 0 ? Math.ceil(tradeRimanenti / velocitaMediaGiornaliera) : Infinity;
      messaggio = `Al ritmo attuale, il 100% del capitale sarà in trading tra circa ${tempoStimato} giorni`;
    } else if (velocitaMediaGiornaliera < 0) {
      // Stiamo diminuendo il capitale in trading, calcoliamo quanto tempo per tornare allo 0%
      tempoStimato = velocitaMediaGiornaliera < 0 ? Math.ceil(ultimoValore / Math.abs(velocitaMediaGiornaliera)) : Infinity;
      messaggio = `Al ritmo attuale, il capitale in trading sarà esaurito tra circa ${tempoStimato} giorni`;
    } else {
      messaggio = "Il capitale in trading è stabile, nessuna variazione rilevata nell'ultimo periodo";
    }
    
    // Crea o aggiorna l'elemento HTML per l'indicatore del tempo
    let indicatoreElement = document.getElementById("indicatoreTempo");
    if (!indicatoreElement) {
      indicatoreElement = document.createElement("div");
      indicatoreElement.id = "indicatoreTempo";
      indicatoreElement.className = "info-box";
      
      // Inseriscilo prima del grafico percentuale
      const container = document.getElementById("tab-percentuale");
      const graficoContainer = container.querySelector(".storico-chart-container");
      container.insertBefore(indicatoreElement, graficoContainer);
    }
    
    // Aggiorna il contenuto dell'indicatore
    indicatoreElement.innerHTML = `
      <strong>Indicatore di Tendenza:</strong> ${messaggio}<br>
      <span class="distribution-label">Variazione media: ${velocitaMediaGiornaliera.toFixed(2)} trade al giorno</span>
    `;
    
    // Aggiungi un colore in base alla tendenza
    if (velocitaMediaGiornaliera > 0) {
      indicatoreElement.style.borderLeft = "4px solid var(--accent-color)";
    } else if (velocitaMediaGiornaliera < 0) {
      indicatoreElement.style.borderLeft = "4px solid var(--secondary-color)";
    } else {
      indicatoreElement.style.borderLeft = "4px solid var(--primary-color)";
    }
  }
  
  // Inizializza l'applicazione quando il documento è pronto
  document.addEventListener('DOMContentLoaded', function() {
    inizializza();
// 	window.addEventListener('resize', gestisciRidimensionamento);
    
    // Aggiungi l'indicatore del tempo dopo l'inizializzazione
    aggiungiIndicatoreTempo();
    
    // Aggiorna l'indicatore quando cambia il range di tempo
    document.querySelectorAll('.time-range-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        aggiungiIndicatoreTempo();
      });
    });
  });
  


// =========== FINE =========== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---





// 4. blocconote.js -  PAGINA BLOCCO NOTE ---

         // Array per memorizzare le note
        let notes = [];
        
        // Carica le note salvate al caricamento della pagina
        document.addEventListener('DOMContentLoaded', () => {
            loadNotes();
            renderNotes();
        });
        
        // Gestione del form di invio delle note
        document.getElementById('note-form').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const titleInput = document.getElementById('note-title');
            const contentInput = document.getElementById('note-content');
            
            const title = titleInput.value.trim();
            const content = contentInput.value.trim();
            
            if (title && content) {
                addNote(title, content);
                titleInput.value = '';
                contentInput.value = '';
            }
        });
        
        // Funzione per aggiungere una nuova nota
        function addNote(title, content) {
            const note = {
                id: Date.now(), // Usa il timestamp come id univoco
                title: title,
                content: content,
                createdAt: new Date().toISOString()
            };
            
            // Aggiungi la nota all'inizio dell'array (per mostrarle in ordine inverso)
            notes.unshift(note);
            
            // Salva e aggiorna la visualizzazione
            saveNotes();
            renderNotes();
        }
        
        // Funzione per eliminare una nota
        function deleteNote(id) {
            if (confirm('Sei sicuro di voler eliminare questa nota?')) {
                notes = notes.filter(note => note.id !== id);
                saveNotes();
                renderNotes();
            }
        }
        
        // Funzione per iniziare la modifica di una nota
        function editNote(id) {
            const note = notes.find(n => n.id === id);
            if (!note) return;
            
            // Trova l'elemento della nota nel DOM
            const noteElement = document.querySelector(`[data-note-id="${id}"]`);
            if (!noteElement) return;
            
            // Nascondi il contenuto normale e mostra il form di modifica
            const noteContent = noteElement.querySelector('.note-content');
            const noteActions = noteElement.querySelector('.note-actions');
            
            // Crea il form di modifica
            const editForm = document.createElement('div');
            editForm.className = 'edit-form';
            editForm.innerHTML = `
                <input type="text" id="edit-title-${id}" value="${note.title}" placeholder="Titolo della nota">
                <textarea id="edit-content-${id}" placeholder="Contenuto della nota">${note.content}</textarea>
                <div class="btn-group">
                    <button onclick="saveEdit(${id})" class="btn-primary">Salva Modifiche</button>
                    <button onclick="cancelEdit(${id})" class="btn-secondary">Annulla</button>
                </div>
            `;
            
            // Nascondi il contenuto originale e mostra il form
            noteContent.style.display = 'none';
            noteActions.style.display = 'none';
            noteElement.appendChild(editForm);
        }
        
        // Funzione per salvare le modifiche
        function saveEdit(id) {
            const titleInput = document.getElementById(`edit-title-${id}`);
            const contentInput = document.getElementById(`edit-content-${id}`);
            
            const newTitle = titleInput.value.trim();
            const newContent = contentInput.value.trim();
            
            if (newTitle && newContent) {
                // Trova e aggiorna la nota
                const noteIndex = notes.findIndex(n => n.id === id);
                if (noteIndex !== -1) {
                    notes[noteIndex].title = newTitle;
                    notes[noteIndex].content = newContent;
                    notes[noteIndex].updatedAt = new Date().toISOString();
                    
                    saveNotes();
                    renderNotes();
                }
            } else {
                alert('Per favore, inserisci sia il titolo che il contenuto della nota.');
            }
        }
        
        // Funzione per annullare la modifica
        function cancelEdit(id) {
            renderNotes(); // Semplicemente ri-renderizza per rimuovere il form di modifica
        }
        
        // Funzione per salvare le note nel localStorage
        function saveNotes() {
            localStorage.setItem('notes', JSON.stringify(notes));
        }
        
        // Funzione per caricare le note dal localStorage
        function loadNotes() {
            const savedNotes = localStorage.getItem('notes');
            if (savedNotes) {
                notes = JSON.parse(savedNotes);
            }
        }
        
        // Funzione per visualizzare le note
        function renderNotes() {
            const notesContainer = document.getElementById('notes-container');
            notesContainer.innerHTML = '';
            
            if (notes.length === 0) {
                notesContainer.innerHTML = `
                    <div class="empty-state">
                        <p>Non hai ancora note. Aggiungi una nuova nota usando il form qui sopra.</p>
                    </div>
                `;
                return;
            }
            
            notes.forEach(note => {
                const noteElement = document.createElement('div');
                noteElement.className = 'note';
                noteElement.setAttribute('data-note-id', note.id);
                
                const updatedText = note.updatedAt ? ` (modificata il ${new Date(note.updatedAt).toLocaleDateString('it-IT')})` : '';
                
                noteElement.innerHTML = `
                    <div class="note-content">
                        <h3>${note.title}</h3>
                        <p>${note.content}</p>
                        <small style="color: #999;">Creata il ${new Date(note.createdAt).toLocaleDateString('it-IT')}${updatedText}</small>
                    </div>
                    <div class="note-actions">
                        <button onclick="editNote(${note.id})" class="btn-edit">Modifica</button>
                        <button onclick="deleteNote(${note.id})" class="btn-danger">Elimina</button>
                    </div>
                `;
                notesContainer.appendChild(noteElement);
            });
        }
        
        // Funzione per scaricare i dati come file JSON
        function scaricaDati() {
            const data = JSON.stringify(notes, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `blocco-note-backup_${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        
        // Funzione per caricare i dati da un file JSON
        function caricaDati() {
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];
            
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const importedNotes = JSON.parse(e.target.result);
                        if (Array.isArray(importedNotes)) {
                            // Opzione 1: Sostituisci tutte le note
                            notes = importedNotes;
                            
                            // Opzione 2: Aggiungi le note importate alle note esistenti
                            // Decommentare per usare questa opzione
                            // notes = [...importedNotes, ...notes];
                            
                            saveNotes();
                            renderNotes();
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
		


// =========== FINE =========== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---
// ================================================================== ---



// 5. regole-trading.js - PAGINA REGOLE DI TRADING ---

  // Array per memorizzare le regole
        let rules = [];
        
        // Carica le regole salvate al caricamento della pagina
        document.addEventListener('DOMContentLoaded', () => {
            loadRules();
            renderRules();
        });
        
        // Gestione anteprima immagine
        document.getElementById('rule-image').addEventListener('change', function(e) {
            const file = e.target.files[0];
            const preview = document.getElementById('image-preview');
            
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                preview.style.display = 'none';
            }
        });
        
        // Gestione del form di invio delle regole
        document.getElementById('rule-form').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const titleInput = document.getElementById('rule-title');
            const contentInput = document.getElementById('rule-content');
            const imageInput = document.getElementById('rule-image');
            const preview = document.getElementById('image-preview');
            
            const title = titleInput.value.trim();
            const content = contentInput.value.trim();
            
            if (title && content) {
                let imageData = null;
                if (imageInput.files[0]) {
                    imageData = preview.src; // Base64 dell'immagine
                }
                
                addRule(title, content, imageData);
                
                // Reset form
                titleInput.value = '';
                contentInput.value = '';
                imageInput.value = '';
                preview.style.display = 'none';
            }
        });
        
        // Funzione per aggiungere una nuova regola
        function addRule(title, content, imageData = null) {
            const rule = {
                id: Date.now(),
                title: title,
                content: content,
                image: imageData,
                createdAt: new Date().toISOString()
            };
            
            // Aggiungi la regola all'inizio dell'array
            rules.unshift(rule);
            
            // Salva e aggiorna la visualizzazione
            saveRules();
            renderRules();
        }
        
        // Funzione per eliminare una regola
        function deleteRule(id) {
            if (confirm('Sei sicuro di voler eliminare questa regola?')) {
                rules = rules.filter(rule => rule.id !== id);
                saveRules();
                renderRules();
            }
        }
        
        // Funzione per salvare le regole nel localStorage
        function saveRules() {
            try {
                localStorage.setItem('tradingRules', JSON.stringify(rules));
            } catch (e) {
                console.error('Errore nel salvataggio:', e);
                alert('Errore nel salvataggio. Le immagini potrebbero essere troppo grandi.');
            }
        }
        
        // Funzione per caricare le regole dal localStorage
        function loadRules() {
            try {
                const savedRules = localStorage.getItem('tradingRules');
                if (savedRules) {
                    rules = JSON.parse(savedRules);
                }
            } catch (e) {
                console.error('Errore nel caricamento:', e);
                rules = [];
            }
        }
        
        // Funzione per visualizzare le regole
        function renderRules() {
            const rulesContainer = document.getElementById('rules-container');
            rulesContainer.innerHTML = '';
            
            if (rules.length === 0) {
                rulesContainer.innerHTML = `
                    <div class="empty-state">
                        <p>Non hai ancora regole. Aggiungi una nuova regola usando il form qui sopra.</p>
                    </div>
                `;
                return;
            }
            
            rules.forEach(rule => {
                const ruleElement = document.createElement('div');
                ruleElement.className = 'rule';
                
                const createdDate = new Date(rule.createdAt).toLocaleString('it-IT');
                
                ruleElement.innerHTML = `
                    <h3>${rule.title}</h3>
                    <div class="rule-date">Creato il: ${createdDate}</div>
                    <div class="rule-content">${rule.content}</div>
                    ${rule.image ? `<img src="${rule.image}" class="rule-image" alt="Immagine regola">` : ''}
                    <div class="rule-actions">
                        <button onclick="deleteRule(${rule.id})" class="btn-danger">Elimina</button>
                    </div>
                `;
                rulesContainer.appendChild(ruleElement);
            });
        }
        
        // Funzione per scaricare i dati come file JSON
        function scaricaDati() {
            const data = JSON.stringify(rules, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `regole-trading-backup_${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        
        // Funzione per caricare i dati da un file JSON
        function caricaDati() {
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];
            
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const importedRules = JSON.parse(e.target.result);
                        if (Array.isArray(importedRules)) {
                            // Sostituisci tutte le regole
                            rules = importedRules;
                            
                            saveRules();
                            renderRules();
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
  
 // =========== FINE =========== ---
