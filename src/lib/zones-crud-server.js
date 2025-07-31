// src/lib/zones-crud-server.js
import * as adminModule from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { Buffer } from 'node:buffer';

const admin = adminModule.default;

// 1. IMPORTAMOS LA NUEVA FUNCIÓN DE INICIALIZACIÓN
import { getFirebaseAdmin } from './firebase-admin-config';


// --- Función de ayuda para generar slug (sin cambios) ---
function generateSlug(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u00f1]/g, 'n') // Manejar la 'ñ'
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}


// --- 1. CREAR ZONA (Create) ---
export async function createZoneServer(zoneData, coverImageBuffer = null) {
  // 2. OBTENEMOS LAS INSTANCIAS DE FIREBASE AL INICIO DE LA FUNCIÓN
  const { adminDb, adminStorage } = getFirebaseAdmin();
  if (!adminDb || !adminStorage) {
    throw new Error("La conexión con Firebase (adminDb o adminStorage) no está inicializada.");
  }

  try {
    let finalData = { ...zoneData };

    if (coverImageBuffer) {
      const bucket = adminStorage.bucket();
      const fileName = `images/zones/${generateSlug(zoneData.translations?.es?.title || 'sin-titulo')}-${Date.now()}`;
      const file = bucket.file(fileName);
      await file.save(coverImageBuffer);
      await file.makePublic();
      finalData.coverImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    } else {
        finalData.coverImage = '';
    }

    finalData.pubDate = Timestamp.fromDate(new Date(finalData.pubDate || Date.now()));
    finalData.slug = `/zones/${generateSlug(finalData.translations?.es?.title || '')}`;

    const docRef = await adminDb.collection("zones").add(finalData);
    return docRef.id;
  } catch (error) {
    console.error("[createZoneServer] Error:", error);
    throw error;
  }
}

// --- 2. LEER ZONAS (Read) ---
export async function getAllZonesServer() {
  const { adminDb } = getFirebaseAdmin();
  if (!adminDb) {
    throw new Error("La conexión con Firebase (adminDb) no está inicializada.");
  }

  try {
    const querySnapshot = await adminDb.collection("zones").orderBy('pubDate', 'desc').get();
    const zones = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.pubDate instanceof Timestamp) {
        data.pubDate = data.pubDate.toDate().toISOString();
      }
      zones.push({ id: doc.id, ...data });
    });
    return zones;
  } catch (error) {
    console.error("[getAllZonesServer] Error:", error);
    throw error;
  }
}

export async function getZoneByIdServer(zoneId) {
  const { adminDb } = getFirebaseAdmin();
  if (!adminDb) {
    throw new Error("La conexión con Firebase (adminDb) no está inicializada.");
  }

  try {
    const docSnap = await adminDb.collection("zones").doc(zoneId).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data.pubDate instanceof Timestamp) {
        data.pubDate = data.pubDate.toDate().toISOString();
      }
      return { id: docSnap.id, ...data };
    }
    return null;
  } catch (error)
 {
    console.error("[getZoneByIdServer] Error:", error);
    throw error;
  }
}

// --- 3. ACTUALIZAR ZONA (Update) ---
export async function updateZoneServer(zoneId, updatedData, newCoverImageBuffer = null) {
  const { adminDb, adminStorage } = getFirebaseAdmin();
  if (!adminDb || !adminStorage) {
    throw new Error("La conexión con Firebase (adminDb o adminStorage) no está inicializada.");
  }

  try {
    const zoneRef = adminDb.collection("zones").doc(zoneId);
    let finalData = { ...updatedData };

    if (finalData.pubDate) {
      finalData.pubDate = Timestamp.fromDate(new Date(finalData.pubDate));
    }

    if (newCoverImageBuffer) {
        // ... tu lógica para subir y borrar imagen ...
    } else if (updatedData.coverImage === null) {
        // ... tu lógica para borrar la imagen existente ...
    }

    if (finalData.translations?.es?.title !== undefined) {
      finalData.slug = `/zones/${generateSlug(finalData.translations.es.title)}`;
    }

    await zoneRef.update(finalData);
  } catch (error) {
    console.error("[updateZoneServer] Error:", error);
    throw error;
  }
}

// --- 4. BORRAR ZONA (Delete) ---
export async function deleteZoneServer(zoneId) {
  const { adminDb, adminStorage } = getFirebaseAdmin();
  if (!adminDb || !adminStorage) {
    throw new Error("La conexión con Firebase (adminDb o adminStorage) no está inicializada.");
  }

  try {
    const zoneRef = adminDb.collection("zones").doc(zoneId);
    const zoneDoc = await zoneRef.get();

    if (zoneDoc.exists) {
      const imageUrl = zoneDoc.data().coverImage;
      if (imageUrl && imageUrl.includes("storage.googleapis.com")) {
        const bucket = adminStorage.bucket();
        // ... tu lógica para borrar imagen de Storage ...
      }
      await zoneRef.delete();
    }
  } catch (error) {
    console.error("[deleteZoneServer] Error:", error);
    throw error;
  }
}