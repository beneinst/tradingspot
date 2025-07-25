 import { initFirebase, caricaDatiPagina, salvaDatiPagina } from './firebase-utils.js';
  
  const nomePagina = "operativita";
  let datiCorrenti = null;
  
  // Test completo
  async function testFirebase() {
    try {
      console.log("🚀 Inizio test Firebase...");
      
      // 1. Inizializza Firebase
      await initFirebase();
      console.log("✅ Firebase inizializzato");
      
      // 2. Carica dati esistenti
      datiCorrenti = await caricaDatiPagina(nomePagina);
      
      // 3. Test di salvataggio
      const datiTest = {
        timestamp: new Date().toISOString(),
        trades: [
          { simbolo: "AAPL", quantita: 100, prezzo: 150 },
          { simbolo: "MSFT", quantita: 50, prezzo: 300 }
        ],
        bilancio: 25000
      };
      
      console.log("🔄 Salvataggio dati test...");
      await salvaDatiPagina(nomePagina, datiTest);
      
      // 4. Ricarica per verificare
      console.log("🔄 Ricaricamento per verifica...");
      const datiRicaricati = await caricaDatiPagina(nomePagina);
      
      if (datiRicaricati) {
        console.log("🎉 TEST SUPERATO! Persistenza funziona");
        console.log("Dati ricaricati:", datiRicaricati);
      } else {
        console.log("❌ TEST FALLITO! Persistenza non funziona");
      }
      
    } catch (error) {
      console.error("💥 Errore durante il test:", error);
    }
  }
  
  // Avvia il test
  testFirebase();
  
  // Funzione per salvare (collegala ai tuoi pulsanti)
  window.salvaDatiTrading = function() {
    if (datiCorrenti) {
      // Aggiorna datiCorrenti con i nuovi valori dalla UI
      datiCorrenti.ultimoAggiornamento = new Date().toISOString();
      salvaDatiPagina(nomePagina, datiCorrenti);
    }
  }