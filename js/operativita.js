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

    currentMonthEntries = savedCurrentEntries ? JSON.parse(savedCurrentEntries) : [];
    historicalEntries   = savedHistoricalEntries ? JSON.parse(savedHistoricalEntries) : [];
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

        
// Funzione per creare un dialog personalizzato
function showCustomPrompt(message, defaultValue = '') {
    return new Promise((resolve, reject) => {
        // Crea l'overlay del modal
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        // Crea il contenuto del modal
        overlay.innerHTML = `
            <div class="modal-content">
                <h3>${message}</h3>
                <input type="text" class="modal-input" value="${defaultValue}" placeholder="Inserisci qui...">
                <div class="modal-buttons">
                    <button class="modal-btn modal-btn-secondary" id="cancelBtn">Annulla</button>
                    <button class="modal-btn modal-btn-primary" id="okBtn">OK</button>
                </div>
            </div>
        `;
        
        // Aggiungi il modal al DOM
        document.body.appendChild(overlay);
        
        // Ottieni riferimenti agli elementi
        const input = overlay.querySelector('.modal-input');
        const okBtn = overlay.querySelector('#okBtn');
        const cancelBtn = overlay.querySelector('#cancelBtn');
        
        // Focus sull'input
        input.focus();
        input.select();
        
        // Gestisci gli eventi
        okBtn.addEventListener('click', () => {
            const value = input.value.trim();
            document.body.removeChild(overlay);
            resolve(value);
        });
        
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(null);
        });
        
        // Gestisci Enter e Escape
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                okBtn.click();
            } else if (e.key === 'Escape') {
                cancelBtn.click();
            }
        });

        // Chiudi cliccando sull'overlay
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                cancelBtn.click();
            }
        });
    });
}

// Funzione specifica per le date (migliore per il tuo caso)
function showDatesDialog() {
    return new Promise((resolve, reject) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        overlay.innerHTML = `
            <div class="modal-content">
                <h3>Inserisci le date del periodo</h3>
                <label for="startDate">Data di inizio (GG.MM.AA):</label>
                <input type="text" id="startDate" class="modal-input" placeholder="es. 01.08.24">
                
                <label for="endDate">Data di fine (GG.MM.AA):</label>
                <input type="text" id="endDate" class="modal-input" value="${getCurrentDate()}">
                
                <div class="modal-buttons">
                    <button class="modal-btn modal-btn-secondary" id="cancelBtn">Annulla</button>
                    <button class="modal-btn modal-btn-primary" id="okBtn">Conferma</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        const startDateInput = overlay.querySelector('#startDate');
        const endDateInput = overlay.querySelector('#endDate');
        const okBtn = overlay.querySelector('#okBtn');
        const cancelBtn = overlay.querySelector('#cancelBtn');
        
        startDateInput.focus();
        
        okBtn.addEventListener('click', () => {
            const startDate = startDateInput.value.trim();
            const endDate = endDateInput.value.trim();
            
            if (!startDate || !endDate) {
                showMessage('Entrambe le date sono obbligatorie!', 'error');
                return;
            }
            
            document.body.removeChild(overlay);
            resolve({ startDate, endDate });
        });
        
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(null);
        });
        
        // Gestisci Enter per passare al campo successivo
        startDateInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                endDateInput.focus();
            } else if (e.key === 'Escape') {
                cancelBtn.click();
            }
        });
        
        endDateInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                okBtn.click();
            } else if (e.key === 'Escape') {
                cancelBtn.click();
            }
        });

        // Chiudi cliccando sull'overlay
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                cancelBtn.click();
            }
        });
    });
}

// SOSTITUISCI la tua funzione closeMonth() con questa:
async function closeMonth() {
    if (currentMonthEntries.length === 0) {
        showMessage('Non ci sono importi da registrare per questo mese!', 'error');
        return;
    }
    
    try {
        // Usa il dialog personalizzato invece di prompt()
        const dates = await showDatesDialog();
        
        if (!dates) {
            return; // L'utente ha annullato
        }
        
        const { startDate, endDate } = dates;
        
        // Verifica che le date siano nel formato corretto
        if (!isValidDateFormat(startDate) || !isValidDateFormat(endDate)) {
            showMessage('Il formato delle date deve essere GG.MM.AA!', 'error');
            return;
        }
        
        // Calcoliamo la media degli importi del mese corrente
        const totalMonthValue = calculateCurrentMonthValue();
        
        // Creiamo una nuova entry per lo storico
        const newHistoricalEntry = {
            periodo: `dal ${startDate} al ${endDate}`,
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
        
    } catch (error) {
        console.error('Errore durante la chiusura del mese:', error);
        showMessage('Errore durante la chiusura del mese', 'error');
    }
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

// Ricarica dati ogni volta che si torna nella pagina (es. da "Indietro")
window.addEventListener('pageshow', () => {
    loadFromLocalStorage();
    updateAll();
});


/* IIFE per ogni blocco (parentesi iniziale corretta) */
(function () {
  // --- LEGGO DA LOCALSTORAGE (se presente)
  const valori = {
    1: JSON.parse(localStorage.getItem('valori_1') || '[]'),
    2: JSON.parse(localStorage.getItem('valori_2') || '[]')
  };

  // rendo gli input più stretti
  document.querySelectorAll('.importo').forEach(inp => inp.style.width = '99px');

  // --- AGGIORNO VISUALIZZAZIONE
  function aggiorna(id) {
    const tot = valori[id].reduce((a, b) => a + b, 0);
    document.getElementById(`totale_${id}`).textContent = Math.round(tot) + ' €';

    // --- SALVO SU LOCALSTORAGE
    localStorage.setItem(`valori_${id}`, JSON.stringify(valori[id]));
  }

  // --- EVENTI BOTTONI
  document.querySelectorAll('.addBtn').forEach(btn =>
    btn.addEventListener('click', e => {
      const id  = e.target.dataset.target;
      const inp = document.getElementById(`importo_${id}`);
      const v   = parseFloat(inp.value);
      if (isNaN(v)) return;
      valori[id].push(v);
      inp.value = '';
      aggiorna(id);
    })
  );

  document.querySelectorAll('.delBtn').forEach(btn =>
    btn.addEventListener('click', e => {
      const id = e.target.dataset.target;
      valori[id].pop();
      aggiorna(id);
    })
  );

  // --- MOSTRO I TOTALI AL CARICAMENTO
  aggiorna(1);
  aggiorna(2);
})();