// src/lib/firebase-admin-config.js
import * as admin from 'firebase-admin';

let instances = null;

// Función para obtener las variables de forma segura
function getRequiredEnv(key) {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`ERROR FATAL: Falta la variable de entorno '${key}' en Vercel.`);
  }
  return value;
}

function initializeFirebaseAdmin() {
  try {
    const serviceAccountCMS = {
      projectId: getRequiredEnv('FIREBASE_PROJECT_ID'),
      clientEmail: getRequiredEnv('FIREBASE_CLIENT_EMAIL'),
      privateKey: getRequiredEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    };

    const serviceAccountStorage = {
      projectId: getRequiredEnv('STORAGE_FIREBASE_PROJECT_ID'),
      clientEmail: getRequiredEnv('STORAGE_FIREBASE_CLIENT_EMAIL'),
      privateKey: getRequiredEnv('STORAGE_FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    };

    let appCMS, appStorage;

    if (!admin.apps.some((app) => app.name === 'appCMS')) {
      appCMS = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountCMS),
        databaseURL: `https://${serviceAccountCMS.projectId}.firebaseio.com`,
      }, 'appCMS');
    } else {
      appCMS = admin.app('appCMS');
    }

    if (!admin.apps.some((app) => app.name === 'appStorage')) {
      appStorage = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountStorage),
        storageBucket: `${serviceAccountStorage.projectId}.appspot.com`,
      }, 'appStorage');
    } else {
      appStorage = admin.app('appStorage');
    }

    instances = {
      adminDb: appCMS.firestore(),
      adminAuth: appCMS.auth(),
      adminStorage: appStorage.storage(),
    };

  } catch (error) {
    console.error("FALLO LA INICIALIZACIÓN DE FIREBASE ADMIN:", error.message);
    instances = { adminDb: null, adminAuth: null, adminStorage: null };
  }
}

// Exportamos una única función que se encarga de todo
export function getFirebaseAdmin() {
  if (!instances) {
    initializeFirebaseAdmin();
  }
  return instances;
}