// SEZIONE CALCOLI OPERATIVI

// Inizializzazione delle variabili
let currentMonthEntries = [];
let historicalEntries = [];

// Caricare dati da localStorage se disponibili
function loadFromLocalStorage() {
    const savedCurrentEntries = localStorage.getItem('currentMonthEntries');
    const savedHistoricalEntries = localStorage.getItem('historicalEntries');

    currentMonthEntries = savedCurrentEntries ? JSON.parse(savedCurrentEntries) : [];
    historicalEntries = savedHistoricalEntries ? JSON.parse(savedHistoricalEntries) : [];
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

// ============ NUOVA FUNZIONE PER TABELLA STORICA ESPANDIBILE ============
function updateHistoricalTable() {
    const tableBody = document.querySelector('#historicalTable tbody');
    tableBody.innerHTML = '';
    
    historicalEntries.forEach((entry, index) => {
        // Riga principale con periodo e totale
        const mainRow = document.createElement('tr');
        mainRow.className = 'historical-main-row';
        mainRow.innerHTML = `
            <td>
                <span class="expand-icon" data-index="${index}">▶</span>
                ${entry.periodo}
            </td>
            <td>${formatImport(entry.importo)}</td>
        `;
        tableBody.appendChild(mainRow);
        
        // Riga dettagli (nascosta inizialmente)
        const detailsRow = document.createElement('tr');
        detailsRow.className = 'historical-details-row';
        detailsRow.style.display = 'none';
        detailsRow.dataset.index = index;
        
        let detailsHTML = '<td colspan="2"><div class="details-container">';
        
        if (entry.dettagli && entry.dettagli.length > 0) {
            detailsHTML += '<table class="details-table">';
            detailsHTML += '<thead><tr><th>Data</th><th>Importo</th></tr></thead>';
            detailsHTML += '<tbody>';
            
            entry.dettagli.forEach(detail => {
                detailsHTML += `
                    <tr>
                        <td>${detail.data}</td>
                        <td>${formatImport(detail.importo)}</td>
                    </tr>
                `;
            });
            
            detailsHTML += '</tbody></table>';
        } else {
            detailsHTML += '<p style="color: #999; font-style: italic;">Nessun dettaglio disponibile per questo periodo</p>';
        }
        
        detailsHTML += '</div></td>';
        detailsRow.innerHTML = detailsHTML;
        tableBody.appendChild(detailsRow);
    });
    
    // Aggiungi event listener per espandere/collassare
    document.querySelectorAll('.expand-icon').forEach(icon => {
        icon.addEventListener('click', function() {
            const index = this.dataset.index;
            const detailsRow = document.querySelector(`.historical-details-row[data-index="${index}"]`);
            
            if (detailsRow.style.display === 'none') {
                detailsRow.style.display = 'table-row';
                this.textContent = '▼';
            } else {
                detailsRow.style.display = 'none';
                this.textContent = '▶';
            }
        });
    });
}

// Funzione per convertire una data in formato italiano (gg.mm.aa) a oggetto Date
function parseItalianDate(dateStr) {
    const [day, month, year] = dateStr.trim().split('.');
    return new Date(`20${year}`, parseInt(month) - 1, parseInt(day));
}

// Funzione corretta per generare il periodo mensile
function generateMonthlyPeriod() {
    const today = new Date();
    let startDate;
    
    if (historicalEntries.length > 0) {
        const lastPeriod = historicalEntries[historicalEntries.length - 1].periodo;
        const endDateStr = lastPeriod.split("al ")[1].trim();
        const endDate = parseItalianDate(endDateStr);
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() + 1);
    } else {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    
    const endDate = new Date(today);
    const formattedStartDate = formatDate(startDate);
    const formattedEndDate = formatDate(endDate);
    
    return `dal ${formattedStartDate} al ${formattedEndDate}`;
}

// Funzione per creare un dialog personalizzato per le date
function showDatesDialog() {
    return new Promise((resolve) => {
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

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                cancelBtn.click();
            }
        });
    });
}

// ============ FUNZIONE CLOSEMONTH MODIFICATA ============
async function closeMonth() {
    if (currentMonthEntries.length === 0) {
        showMessage('Non ci sono importi da registrare per questo mese!', 'error');
        return;
    }
    
    try {
        const dates = await showDatesDialog();
        
        if (!dates) {
            return;
        }
        
        const { startDate, endDate } = dates;
        
        if (!isValidDateFormat(startDate) || !isValidDateFormat(endDate)) {
            showMessage('Il formato delle date deve essere GG.MM.AA!', 'error');
            return;
        }
        
        const totalMonthValue = calculateCurrentMonthValue();
        
        // *** NOVITÀ: Salviamo anche i dettagli degli importi singoli ***
        const newHistoricalEntry = {
            periodo: `dal ${startDate} al ${endDate}`,
            importo: totalMonthValue,
            dettagli: [...currentMonthEntries] // Copia profonda dei dettagli
        };
        
        historicalEntries.push(newHistoricalEntry);
        currentMonthEntries = [];
        
        saveToLocalStorage();
        updateAll();
        
        showMessage('Mese chiuso con successo! I dettagli sono stati salvati.', 'success');
        
    } catch (error) {
        console.error('Errore durante la chiusura del mese:', error);
        showMessage('Errore durante la chiusura del mese', 'error');
    }
}

// Funzione per verificare il formato della data
function isValidDateFormat(dateStr) {
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
    
    currentMonthEntries.push({
        data: getCurrentDate(),
        importo: importo
    });
    
    saveToLocalStorage();
    updateAll();
    importInput.value = '';
    
    showMessage('Importo aggiunto con successo!', 'success');
}

// Funzione per eliminare l'ultimo dato inserito
function deleteLastEntry() {
    if (currentMonthEntries.length === 0) {
        showMessage('Non ci sono importi da cancellare!', 'error');
        return;
    }
    
    const removedEntry = currentMonthEntries.pop();
    saveToLocalStorage();
    updateAll();
    
    showMessage(`Ultimo importo (${formatImport(removedEntry.importo)}) cancellato con successo!`, 'success');
}

// Funzione per mostrare messaggi
function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.className = type;
    
    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = '';
    }, 5000);
}

// ============ NUOVA FUNZIONE: DOWNLOAD DETTAGLI COMPLETI CSV ============
function downloadDetailedCSV() {
    if (historicalEntries.length === 0) {
        showMessage('Non ci sono dati storici da scaricare!', 'error');
        return;
    }
    
    let csv = 'Periodo,Data Singola,Importo Singolo,Totale Periodo\n';
    
    historicalEntries.forEach(entry => {
        if (entry.dettagli && entry.dettagli.length > 0) {
            entry.dettagli.forEach((detail, idx) => {
                csv += `"${entry.periodo}",${detail.data},${formatImport(detail.importo)}`;
                if (idx === 0) {
                    csv += `,${formatImport(entry.importo)}`;
                }
                csv += '\n';
            });
        } else {
            csv += `"${entry.periodo}",N/D,N/D,${formatImport(entry.importo)}\n`;
        }
        csv += '\n'; // Riga vuota tra periodi
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `storico_dettagliato_${getCurrentDate().replace(/\./g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    showMessage('CSV dettagliato scaricato con successo!', 'success');
}

// ============ FUNZIONE DOWNLOAD HTML MIGLIORATA ============
function downloadCombinedTablesHTML() {
    if (currentMonthEntries.length === 0 && historicalEntries.length === 0) {
        showMessage('Non ci sono dati da scaricare!', 'error');
        return;
    }

    // Tabella Importi Mese Corrente
    let currentMonthTableHTML = `
        <h3>Importi Mese Corrente</h3>
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
    `;

    // Tabella Storico Mensile con Dettagli
    let historicalTableHTML = `
        <h3>Storico Mensile (con Dettagli)</h3>
    `;
    
    historicalEntries.forEach(entry => {
        const total = parseFloat(entry.importo);
        
        historicalTableHTML += `
            <h4>${entry.periodo} - Totale: ${formatImport(total)}</h4>
            <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Importo (€)</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        if (entry.dettagli && entry.dettagli.length > 0) {
            entry.dettagli.forEach(detail => {
                historicalTableHTML += `
                    <tr>
                        <td>${detail.data}</td>
                        <td>${formatImport(detail.importo)}</td>
                    </tr>
                `;
            });
        } else {
            historicalTableHTML += `
                <tr>
                    <td colspan="2" style="text-align: center; color: #999;">Dettagli non disponibili</td>
                </tr>
            `;
        }
        
        historicalTableHTML += `
                    <tr style="font-weight: bold; background: #eef;">
                        <td>TOTALE PERIODO</td>
                        <td>${formatImport(total)}</td>
                    </tr>
                </tbody>
            </table>
        `;
    });

    const combinedHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Storico Dettagliato Trading</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        table { margin-bottom: 20px; }
        th { background: #4caf50; color: white; }
    </style>
</head>
<body>
    <h1>Report Trading Completo</h1>
    ${currentMonthTableHTML}
    <br><br>
    ${historicalTableHTML}
</body>
</html>
    `;

    const blob = new Blob([combinedHTML], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `report_completo_${getCurrentDate().replace(/\./g, '-')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    showMessage('Report completo scaricato con successo!', 'success');
}

// Funzione per esportare i dati
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
                
                saveToLocalStorage();
                updateAll();
                
                showMessage('Dati ripristinati con successo!', 'success');
            } else {
                showMessage('Il file di backup non è valido!', 'error');
            }
        } catch (err) {
            showMessage('Errore durante il caricamento del backup: ' + err.message, 'error');
        }
        
        fileInput.value = '';
    };
    
    reader.readAsText(file);
}

// Funzione per aggiornare tutto
function updateAll() {
    updateCurrentMonthTable();
    updateHistoricalTable();
    updateDashboard();
    createChart();
}

// Event listeners
document.getElementById('addButton').addEventListener('click', addImport);
document.getElementById('importInput').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        addImport();
    }
});
document.getElementById('deleteLastButton').addEventListener('click', deleteLastEntry);
document.getElementById('closeMonthButton').addEventListener('click', closeMonth);
document.getElementById('scaricaDatiBtn').addEventListener('click', scaricaDati);
document.getElementById('caricaDatiBtn').addEventListener('click', caricaDati);

// *** NUOVO BUTTON LISTENER PER CSV DETTAGLIATO ***
document.getElementById('downloadDetailedBtn').addEventListener('click', downloadDetailedCSV);

document.getElementById('downloadTableBtn').addEventListener('click', downloadCombinedTablesHTML);

document.getElementById('fileInput').addEventListener('change', function() {
    const fileName = this.files[0]?.name;
    if (fileName) {
        this.nextElementSibling.textContent = fileName;
    } else {
        this.nextElementSibling.textContent = 'Seleziona File';
    }
});

// Funzione per creare il grafico
function createChart() {
    const canvas = document.getElementById('monthlyChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (historicalEntries.length === 0) {
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Nessun dato storico disponibile', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    const values = historicalEntries.map(entry => parseFloat(entry.importo));
    const labels = historicalEntries.map(entry => entry.periodo.split('al ')[1].trim());
    
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;
    const averageValue = values.reduce((sum, value) => sum + value, 0) / values.length;
    
    const padding = 50;
    const chartWidth = canvas.width - (padding * 2);
    const chartHeight = canvas.height - (padding * 2);
    
    // Assi
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();
    
    // Linea media
    const averageY = canvas.height - padding - ((averageValue - minValue) / range) * chartHeight;
    ctx.strokeStyle = '#ff9800';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, averageY);
    ctx.lineTo(canvas.width - padding, averageY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = '#ff9800';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Media: ${formatImport(averageValue)}`, canvas.width - padding - 100, averageY - 8);
    
    // Linea grafico
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
    
    // Punti
    ctx.fillStyle = '#fff';
    values.forEach((value, index) => {
        const x = padding + (index * chartWidth) / Math.max(values.length - 1, 1);
        const y = canvas.height - padding - ((value - minValue) / range) * chartHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(formatImport(value), x, y - 10);
        ctx.fillStyle = '#4caf50';
    });
    
    // Etichette X
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    labels.forEach((label, index) => {
        const x = padding + (index * chartWidth) / Math.max(labels.length - 1, 1);
        ctx.fillText(label, x, canvas.height - 20);
    });
}

// Inizializzazione
loadFromLocalStorage();
updateAll();

window.addEventListener('pageshow', () => {
    loadFromLocalStorage();
    updateAll();
});