// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

// Pruebas

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCNvy_oBcHthIXcV8I4yO1U9NuPcUtShDc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "chat-zosen.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "chat-zosen",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "chat-zosen.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1077366693270",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1077366693270:web:2fb30da6710fdcdc7051b7"
};

/*
//PRD
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDAVWt5ZOZzuo4Z2QkJy-i1fNYK9WeOxZg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "testovercome.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "testovercome",
  databaseURL: "https://testovercome-default-rtdb.firebaseio.com",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "testovercome.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "143432511840",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:143432511840:web:0dae09c4cf8c80edaeee05"
};
*/
// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar los servicios que utilizaremos
export const auth = getAuth(app);
//export const db = getFirestore(app);
export const db = getDatabase(app);