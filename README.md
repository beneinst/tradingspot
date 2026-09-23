# tradingspot
L'app per la contabilità del Trading Spot di GD

## Documenti fiscali

La pagina Backup contiene un archivio locale per PDF, immagini, CSV, documenti Office e ZIP (20 MB per file). Permette caricamento multiplo, modifica di anno/categoria/note, ricerca, filtri, download ed eliminazione. I duplicati sono riconosciuti dal contenuto SHA-256.

I file sono salvati in IndexedDB nel browser e non vengono caricati su servizi esterni. L'archivio dipende dal browser e dall'origine dell'app: copiare la cartella HTML non copia i dati del browser. Per trasferire i documenti usare **Esporta archivio documenti** e **Importa archivio documenti** nella pagina Backup. Questi file JSON sono separati dal backup dei dati del tracker e contengono gli allegati, senza cifratura. Il ripristino aggiunge i file mancanti e conserva quelli presenti. La cancellazione dei dati del browser elimina anche l'archivio locale.

L'esportazione completa supporta 100 MB di documenti; oltre questa soglia usare i download singoli. L'importazione verifica tutti i file prima di salvarli in una singola transazione. Per il funzionamento usare HTTPS o localhost.

Il restyling della home conserva le dimensioni dei grafici e la logica dei dati manuali.

### Verifica

Con Node.js, Playwright e Chrome disponibili: `node tests/documenti-fiscali.test.cjs` (configurare NODE_PATH se Playwright non è installato nel progetto). Il test usa un browser temporaneo e dati fittizi: caricamento, persistenza, duplicati, metadati, filtri, download ed esportazione/ripristino identici byte per byte, archivio corrotto, protezione dall'importazione nel pulsante sbagliato e layout a 390/768/1440 px. Le anteprime vengono scritte nella cartella temporanea del sistema.
