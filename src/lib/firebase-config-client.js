// src/lib/firebase-config-client.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);