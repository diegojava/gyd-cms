// src/lib/firebase-admin-config.js
import * as adminModule from 'firebase-admin';
const admin = adminModule.default;

let instances = null;

function initializeFirebaseAdmin() {
  try {
    const serviceAccount = {
      projectId: import.meta.env.FIREBASE_PROJECT_ID,
      clientEmail: import.meta.env.FIREBASE_CLIENT_EMAIL,
      privateKey: import.meta.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };

    // Inicializamos una sola app con todos los servicios que necesita
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: serviceAccount.projectId,
      });
    }

    instances = {
      adminDb: admin.firestore(),
      adminAuth: admin.auth(),
      adminStorage: admin.storage(),
    };

  } catch (error) {
    console.error("FALLO LA INICIALIZACIÓN DE FIREBASE ADMIN:", error.message);
    instances = { adminDb: null, adminAuth: null, adminStorage: null };
  }
}

// Exportamos la función que se encarga de todo
export function getFirebaseAdmin() {
  if (!instances) {
    initializeFirebaseAdmin();
  }
  return instances;
}