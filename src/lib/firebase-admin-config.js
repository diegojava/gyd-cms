import * as admin from 'firebase-admin';

// --- CREDENCIALES DEL PROYECTO CMS (leídas por separado) ---
const serviceAccountCMS = {
  projectId: import.meta.env.CMS_FIREBASE_PROJECT_ID,
  clientEmail: import.meta.env.CMS_FIREBASE_CLIENT_EMAIL,
  // Reemplaza los "\\n" por saltos de línea reales para la llave privada
  privateKey: import.meta.env.CMS_FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
};

// --- CREDENCIALES DEL PROYECTO STORAGE (leídas por separado) ---
const serviceAccountStorage = {
  projectId: import.meta.env.STORAGE_FIREBASE_PROJECT_ID,
  clientEmail: import.meta.env.STORAGE_FIREBASE_CLIENT_EMAIL,
  // Reemplaza los "\\n" por saltos de línea reales para la llave privada
  privateKey: import.meta.env.STORAGE_FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
};


// --- INICIALIZAR LA APP DEL CMS ---
let appCMS;
if (!admin.apps.some((app) => app.name === 'appCMS')) {
  appCMS = admin.initializeApp({
    credential: admin.credential.cert(serviceAccountCMS),
    databaseURL: `https://${serviceAccountCMS.projectId}.firebaseio.com`,
  }, 'appCMS'); // Nombre de la instancia
} else {
  appCMS = admin.app('appCMS');
}

// --- INICIALIZAR LA APP DE STORAGE ---
let appStorage;
if (!admin.apps.some((app) => app.name === 'appStorage')) {
  appStorage = admin.initializeApp({
    credential: admin.credential.cert(serviceAccountStorage),
    storageBucket: `${serviceAccountStorage.projectId}.appspot.com`,
  }, 'appStorage'); // Nombre de la instancia
} else {
  appStorage = admin.app('appStorage');
}


// --- Exportar las instancias de los servicios ---
// Usamos cada app para obtener sus respectivos servicios
export const adminDb = appCMS.firestore();
export const adminAuth = appCMS.auth();
export const adminStorage = appStorage.storage();