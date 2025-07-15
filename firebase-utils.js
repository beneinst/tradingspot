// Importa i moduli Firebase (versione web modular)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// 🔐 CONFIGURAZIONE FIREBASE (progetto Invest Flow)
const firebaseConfig = {
  apiKey: "AIzaSyClBy8HBFOGtlpFMP-CvB169BbQiAHZiyE",
  authDomain: "invest-flow-fecf5.firebaseapp.com",
  projectId: "invest-flow-fecf5",
  storageBucket: "invest-flow-fecf5.appspot.com",
  messagingSenderId: "249110279349",
  appId: "1:249110279349:web:placeholder" // può restare così
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 🆔 ID fisso per usare sempre lo stesso documento
let userId = "gerardo_investflow";

// Inizializza Firebase Auth (serve per usare Firestore)
export async function initFirebase() {
  await signInAnonymously(auth); // Necessario per usare Firestore anche se userId è fisso
  return userId;
}

// 📥 Carica i dati di una pagina dal documento dell'utente
export async function caricaDatiPagina(nomePagina) {
  const docRef = doc(db, "utenti", userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists() && docSnap.data()[nomePagina]) {
    return docSnap.data()[nomePagina];
  }
  return null;
}

// 📤 Salva i dati della pagina nel documento dell'utente
export async function salvaDatiPagina(nomePagina, dati) {
  const docRef = doc(db, "utenti", userId);
  const update = { [nomePagina]: dati };
  await setDoc(docRef, update, { merge: true }); // 🔁 merge mantiene intatti gli altri dati
}
