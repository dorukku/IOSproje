// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDa2eWbsGx8d8SVXw_V0uJDJMuXTCUNDHo",
  authDomain: "chatapp-b3f80.firebaseapp.com",
  projectId: "chatapp-b3f80",
  storageBucket: "chatapp-b3f80.appspot.com",
  messagingSenderId: "182792381197",
  appId: "1:182792381197:web:6e82823d8842447f594644",
  measurementId: "G-VESHREB155"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

