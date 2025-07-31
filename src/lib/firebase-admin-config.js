import * as admin from 'firebase-admin';

// Función para verificar que una variable de entorno exista
function getRequiredEnv(key) {
  const value = import.meta.env[key];
  if (!value) {
    // Si una variable no existe, el build fallará con este mensaje claro
    throw new Error(`ERROR FATAL: Falta la variable de entorno requerida '${key}' en la configuración de Vercel.`);
  }
  return value;
}

let serviceAccountCMS = null;
let serviceAccountStorage = null;

try {
  // --- CREDENCIALES DEL PROYECTO CMS ---
  serviceAccountCMS = {
    projectId: getRequiredEnv('FIREBASE_PROJECT_ID'),
    clientEmail: getRequiredEnv('FIREBASE_CLIENT_EMAIL'),
    privateKey: getRequiredEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
  };

  // --- CREDENCIALES DEL PROYECTO STORAGE ---
  serviceAccountStorage = {
    projectId: getRequiredEnv('STORAGE_FIREBASE_PROJECT_ID'),
    clientEmail: getRequiredEnv('STORAGE_FIREBASE_CLIENT_EMAIL'),
    privateKey: getRequiredEnv('STORAGE_FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
  };
} catch (error) {
  console.error(error.message);
}


// --- INICIALIZAR LA APP DEL CMS ---
let appCMS;
if (serviceAccountCMS && !admin.apps.some((app) => app.name === 'appCMS')) {
  appCMS = admin.initializeApp({
    credential: admin.credential.cert(serviceAccountCMS),
    databaseURL: `https://${serviceAccountCMS.projectId}.firebaseio.com`,
  }, 'appCMS');
} else {
  appCMS = admin.apps.find(app => app.name === 'appCMS');
}

// --- INICIALIZAR LA APP DE STORAGE ---
let appStorage;
if (serviceAccountStorage && !admin.apps.some((app) => app.name === 'appStorage')) {
  appStorage = admin.initializeApp({
    credential: admin.credential.cert(serviceAccountStorage),
    storageBucket: `${serviceAccountStorage.projectId}.appspot.com`,
  }, 'appStorage');
} else {
  appStorage = admin.apps.find(app => app.name === 'appStorage');
}


// --- Exportar las instancias de los servicios ---
export const adminDb = appCMS ? appCMS.firestore() : null;
export const adminAuth = appCMS ? appCMS.auth() : null;
export const adminStorage = appStorage ? appStorage.storage() : null;