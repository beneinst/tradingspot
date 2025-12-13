// firebase-utils.js con debug migliorato
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyClBy8HBFOGtlpFMP-CvB169BbQiAHZiyE",
  authDomain: "invest-flow-fecf5.firebaseapp.com",
  projectId: "invest-flow-fecf5",
  storageBucket: "invest-flow-fecf5.appspot.com",
  messagingSenderId: "249110279349",
  appId: "1:249110279349:web:placeholder"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let userId = "gerardo_investflow";

export async function initFirebase() {
  try {
    console.log("🔄 Inizializing Firebase Auth...");
    const userCredential = await signInAnonymously(auth);
    console.log("✅ Firebase Auth OK:", userCredential.user.uid);
    return userId;
  } catch (error) {
    console.error("❌ Errore Firebase Auth:", error);
    throw error;
  }
}

export async function caricaDatiPagina(nomePagina) {
  try {
    console.log(`🔄 Caricamento dati per pagina: ${nomePagina}`);
    const docRef = doc(db, "utenti", userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log("📄 Documento completo:", data);
      
      if (data[nomePagina]) {
        console.log(`✅ Dati trovati per ${nomePagina}:`, data[nomePagina]);
        return data[nomePagina];
      } else {
        console.log(`ℹ️ Nessun dato per la pagina ${nomePagina}`);
        return null;
      }
    } else {
      console.log("ℹ️ Documento utente non esiste ancora");
      return null;
    }
  } catch (error) {
    console.error("❌ Errore caricamento:", error);
    return null;
  }
}

export async function salvaDatiPagina(nomePagina, dati) {
  try {
    console.log(`🔄 Salvataggio dati per pagina: ${nomePagina}`, dati);
    const docRef = doc(db, "utenti", userId);
    const update = { [nomePagina]: dati };
    
    await setDoc(docRef, update, { merge: true });
    console.log(`✅ Dati salvati con successo per ${nomePagina}`);
    
    // Verifica immediata del salvataggio
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      console.log("🔍 Verifica post-salvataggio:", docSnap.data());
    }
  } catch (error) {
    console.error("❌ Errore salvataggio:", error);
    throw error;
  }
}