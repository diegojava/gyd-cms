// src/lib/listings-crud-server.js
import { getFirebaseAdmin } from './firebase-admin-config';
import { Timestamp } from 'firebase-admin/firestore';
import { Buffer } from 'node:buffer';
import * as admin from 'firebase-admin';

// --- Función de ayuda para generar slug (sin cambios) ---
function generateSlug(title) {
  if (!title) return '';
  return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

// --- 1. CREAR LISTING (Función Principalmente Actualizada) ---
export async function createListingServer(listingData, coverImageBuffer = null) {
  const { adminDb, adminStorage } = getFirebaseAdmin();
  if (!adminDb || !adminStorage) {
    throw new Error("La conexión con Firebase no está inicializada.");
  }

  try {
    // El objeto listingData ya viene con la estructura correcta desde la API
    let finalData = { ...listingData };

    // Manejar la subida de la imagen (sin cambios en la lógica)
    if (coverImageBuffer) {
      const bucket = adminStorage.bucket();
      const fileName = `images/listings/${generateSlug(listingData.translations?.es?.title || 'sin-titulo')}-${Date.now()}`;
      const file = bucket.file(fileName);
      await file.save(coverImageBuffer);
      await file.makePublic();
      finalData.coverImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    } else {
      finalData.coverImage = '';
    }

    // Convertir la fecha a un Timestamp de Firestore
    finalData.pubDate = Timestamp.fromDate(new Date(listingData.pubDate));

    // Generar slugs
    finalData.slug = {
      es: generateSlug(listingData.translations?.es?.title),
      en: generateSlug(listingData.translations?.en?.title)
    };

    // Guardar el objeto completo en la colección "listings"
    // Firestore guardará todos los campos nuevos automáticamente (price, area, amenities, etc.)
    const docRef = await adminDb.collection("listings").add(finalData);
    return docRef.id;
  } catch (error) {
    console.error("[createListingServer] Error:", error);
    throw error;
  }
}

// --- 2. LEER LISTINGS (sin cambios funcionales, solo de nombre) ---
export async function getAllListingsServer() {
  const { adminDb } = getFirebaseAdmin();
  if (!adminDb) throw new Error("Firebase no inicializado.");

  try {
    const querySnapshot = await adminDb.collection("listings").orderBy('pubDate', 'desc').get();
    const listings = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.pubDate instanceof Timestamp) {
        data.pubDate = data.pubDate.toDate().toISOString();
      }
      listings.push({ id: doc.id, ...data });
    });
    return listings;
  } catch (error) {
    console.error("[getAllListingsServer] Error:", error);
    throw error;
  }
}

export async function getListingByIdServer(listingId) {
  const { adminDb } = getFirebaseAdmin();
  if (!adminDb) throw new Error("Firebase no inicializado.");

  try {
    const docSnap = await adminDb.collection("listings").doc(listingId).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data.pubDate instanceof Timestamp) {
        data.pubDate = data.pubDate.toDate().toISOString();
      }
      return { id: docSnap.id, ...data };
    }
    return null;
  } catch (error) {
    console.error("[getListingByIdServer] Error:", error);
    throw error;
  }
}


// --- 3. ACTUALIZAR LISTING (También actualizado para los nuevos campos) ---
export async function updateListingServer(listingId, updatedData, newCoverImageBuffer = null) {
  const { adminDb, adminStorage } = getFirebaseAdmin();
  if (!adminDb || !adminStorage) {
    throw new Error("Firebase no inicializado.");
  }

  try {
    const listingRef = adminDb.collection("listings").doc(listingId);

    // La API Route debe construir un objeto 'updatedData' con los campos a cambiar.
    // Esta función lo guardará. Si se envía una imagen, se procesará aquí.
    if (newCoverImageBuffer) {
      const bucket = adminStorage.bucket();
      const fileName = `images/listings/${listingId}-${Date.now()}`;
      const file = bucket.file(fileName);
      await file.save(newCoverImageBuffer);
      await file.makePublic();
      updatedData.coverImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    }

    if (updatedData.pubDate) {
      updatedData.pubDate = Timestamp.fromDate(new Date(updatedData.pubDate));
    }

    await listingRef.update(updatedData);

  } catch (error) {
    console.error("[updateListingServer] Error:", error);
    throw error;
  }
}

// --- 4. BORRAR LISTING (sin cambios funcionales) ---
export async function deleteListingServer(listingId) {
  const { adminDb, adminStorage } = getFirebaseAdmin();
  if (!adminDb || !adminStorage) throw new Error("Firebase no inicializado.");

  try {
    const listingRef = adminDb.collection("listings").doc(listingId);
    // ...lógica para borrar imagen de storage si existe...
    await listingRef.delete();
  } catch (error) {
    console.error("[deleteListingServer] Error:", error);
    throw error;
  }
}