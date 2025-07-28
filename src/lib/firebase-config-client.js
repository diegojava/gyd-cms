// src/lib/firebase-config-client.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';


 const firebaseConfig = {
  apiKey: "AIzaSyCDZNK9I3vvOWHzIElLf0NrlV0Q2Pq_VR4",
  authDomain: "gyd-cms.firebaseapp.com",
  projectId: "gyd-cms",
  storageBucket: "gyd-cms.firebasestorage.app",
  messagingSenderId: "1015954699793",
  appId: "1:1015954699793:web:08f330853d12c1fdfae3b0",
  measurementId: "G-QGPVQ3LLVE"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);