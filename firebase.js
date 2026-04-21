import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyC6mDWoZbmW-ysh-sJTpnjKTti-ja6WLw0",
  authDomain:        "doxa-deportes-78ded.firebaseapp.com",
  projectId:         "doxa-deportes-78ded",
  storageBucket:     "doxa-deportes-78ded.firebasestorage.app",
  messagingSenderId: "819025564900",
  appId:             "1:819025564900:web:f86309fea362a14c1b08f1"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);