import * as admin from 'firebase-admin';

// --- CREDENCIALES DEL PROYECTO CMS (leídas con los nombres de Vercel) ---
const serviceAccountCMS = {
  // Usamos la nueva variable que acabas de crear
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  // Usamos los nombres sin el prefijo "CMS_"
  clientEmail: import.meta.env.PUBLIC_FIREBASE_CLIENT_EMAIL,
  privateKey: import.meta.env.PUBLIC_FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
};

// --- CREDENCIALES DEL PROYECTO STORAGE (estas ya estaban bien) ---
const serviceAccountStorage = {
  projectId: import.meta.env.STORAGE_FIREBASE_PROJECT_ID,
  clientEmail: import.meta.env.STORAGE_FIREBASE_CLIENT_EMAIL,
  privateKey: import.meta.env.STORAGE_FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
};


// --- INICIALIZAR LA APP DEL CMS ---
let appCMS;
if (!admin.apps.some((app) => app.name === 'appCMS')) {
  // Verificamos que las credenciales del CMS no estén vacías antes de inicializar
  if (serviceAccountCMS.projectId && serviceAccountCMS.clientEmail && serviceAccountCMS.privateKey) {
    appCMS = admin.initializeApp({
      credential: admin.credential.cert(serviceAccountCMS),
      databaseURL: `https://${serviceAccountCMS.projectId}.firebaseio.com`,
    }, 'appCMS');
  } else {
    console.error("Faltan las credenciales del Admin SDK para CMS.");
  }
} else {
  appCMS = admin.app('appCMS');
}

// --- INICIALIZAR LA APP DE STORAGE ---
let appStorage;
if (!admin.apps.some((app) => app.name === 'appStorage')) {
  // Verificamos que las credenciales de Storage no estén vacías
  if (serviceAccountStorage.projectId && serviceAccountStorage.clientEmail && serviceAccountStorage.privateKey) {
    appStorage = admin.initializeApp({
      credential: admin.credential.cert(serviceAccountStorage),
      storageBucket: `${serviceAccountStorage.projectId}.appspot.com`,
    }, 'appStorage');
  } else {
    console.error("Faltan las credenciales del Admin SDK para Storage.");
  }
} else {
  appStorage = admin.app('appStorage');
}


// --- Exportar las instancias de los servicios ---
// Añadimos una comprobación para no exportar instancias que no se pudieron crear
export const adminDb = appCMS ? appCMS.firestore() : null;
export const adminAuth = appCMS ? appCMS.auth() : null;
export const adminStorage = appStorage ? appStorage.storage() : null;