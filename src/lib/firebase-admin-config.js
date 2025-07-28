// src/lib/firebase-admin-config.js
import * as adminModule from 'firebase-admin';
import { Buffer } from 'node:buffer';

// El objeto 'admin' real del SDK se encuentra en la propiedad 'default'
const admin = adminModule.default;

// Función de ayuda para decodificar y parsear JSON de Base64
function decodeServiceAccount(base64String, errorMessage) {
  try {
    if (!base64String) {
      throw new Error(errorMessage);
    }
    const decodedJson = Buffer.from(base64String, 'base64').toString('utf8');
    return JSON.parse(decodedJson);
  } catch (e) {
    console.error("Error decodificando o parseando:", errorMessage, e);
    throw new Error(errorMessage + ": " + e.message);
  }
}

// --- CREDENCIALES DEL PROYECTO CMS (gyd-cms - para Firestore y Auth) ---
const serviceAccountCMS = decodeServiceAccount(
  import.meta.env.FIREBASE_ADMIN_SDK_CONFIG_CMS_BASE64,
  "FIREBASE_ADMIN_SDK_CONFIG_CMS_BASE64 environment variable is not set or invalid."
);

// --- CREDENCIALES DEL PROYECTO DE STORAGE (getyourdepa - para el bucket) ---
const serviceAccountStorage = decodeServiceAccount(
  import.meta.env.FIREBASE_ADMIN_SDK_CONFIG_STORAGE_BASE64,
  "FIREBASE_ADMIN_SDK_CONFIG_STORAGE_BASE64 environment variable is not set or invalid."
);

// --- INICIALIZAR LA APP DEL CMS ---
let appCMS;
if (!admin.apps.some(app => app.name === 'appCMS')) {
  appCMS = admin.initializeApp({
    credential: admin.credential.cert(serviceAccountCMS),
    projectId: serviceAccountCMS.project_id, // Añadir projectId para mayor claridad
    databaseURL: `https://${serviceAccountCMS.project_id}.firebaseio.com`,
  }, 'appCMS'); // Nombre de instancia 'appCMS'
} else {
  appCMS = admin.app('appCMS');
}

// --- INICIALIZAR LA APP DE STORAGE ---
let appStorage;
if (!admin.apps.some(app => app.name === 'appStorage')) {
  appStorage = admin.initializeApp({
    credential: admin.credential.cert(serviceAccountStorage),
    projectId: serviceAccountStorage.project_id, // Añadir projectId para mayor claridad
    storageBucket: `${serviceAccountStorage.project_id}.firebasestorage.app` // Usar el bucket de este proyecto
  }, 'appStorage'); // Nombre de instancia 'appStorage'
} else {
  appStorage = admin.app('appStorage');
}

// Exportar las instancias de los servicios
// Firestore y Auth vienen del proyecto CMS
export const adminDb = appCMS.firestore();
export const adminAuth = appCMS.auth();

// Storage viene del proyecto de Storage
// Nota: adminStorage.bucket() sin argumentos usará el bucket por defecto de appStorage.
// Si tu bucket 'getyourdepa-bucket.firebasestorage.app' NO es el bucket por defecto del proyecto 'getyourdepa',
// tendrías que especificarlo aquí: adminStorage.bucket('getyourdepa-bucket.firebasestorage.app');
export const adminStorage = appStorage.storage();