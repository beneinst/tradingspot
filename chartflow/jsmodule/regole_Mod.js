 import { initFirebase, caricaDatiPagina, salvaDatiPagina } from './firebase-utils.js';

  const nomePagina = "regole"; // cambia per ogni pagina!

  let datiCorrenti = null;

  // Avvio
  initFirebase().then(async () => {
    datiCorrenti = await caricaDatiPagina(nomePagina);
    if (datiCorrenti) {
      console.log("✅ Dati caricati:", datiCorrenti);
      // carica nella UI
    } else {
      console.log("ℹ️ Nessun dato presente.");
    }
  });

  // Quando vuoi salvare (es. su pulsante o evento)
  function salva() {
    // datiCorrenti = aggiorna con i nuovi dati
    salvaDatiPagina(nomePagina, datiCorrenti);
  }