import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// 🔐 CONFIGURAZIONE FIREBASE
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

let userId = null;

export async function initFirebase() {
  const result = await signInAnonymously(auth);
  userId = result.user.uid;
  return userId;
}

export async function caricaDatiPagina(nomePagina) {
  const docRef = doc(db, "utenti", userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists() && docSnap.data()[nomePagina]) {
    return docSnap.data()[nomePagina];
  }
  return null;
}

export async function salvaDatiPagina(nomePagina, dati) {
  const docRef = doc(db, "utenti", userId);
  const update = { [nomePagina]: dati };
  await setDoc(docRef, update, { merge: true }); // 🔁 merge mantiene le altre pagine
}
