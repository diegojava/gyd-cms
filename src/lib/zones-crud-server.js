// src/lib/zones-crud-server.js
// ¡IMPORTANTE! Este archivo SOLO debe ser importado en tus API Routes.
// NUNCA en código que se ejecute en el navegador.

import * as adminModule from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { Buffer } from 'node:buffer';

const admin = adminModule.default; // Acceder al objeto real del SDK

// Asegúrate de que las instancias de adminDb, adminStorage y adminAuth se exporten desde tu configuración
import { adminDb, adminStorage, adminAuth } from './firebase-admin-config';


// --- Función de ayuda para generar slug ---
// Esta función crea slugs limpios y aptos para URL.
function generateSlug(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}


// --- 1. CREAR ZONA (Create) ---
/**
 * Crea un nuevo documento de zona en Firestore, subiendo la imagen de portada a Storage.
 * @param {Object} zoneData - Objeto con los datos de la zona (translations.es.title, description, excerpt, etc.)
 * @param {Buffer | null} coverImageBuffer - Buffer de datos de la imagen de portada (opcional).
 * @returns {Promise<string>} ID del documento creado.
 */
export async function createZoneServer(zoneData, coverImageBuffer = null) {
  try {
    let finalData = { ...zoneData };
    console.log(`[createZoneServer] Iniciando creación de zona. Título ES: "${zoneData.translations?.es?.title}"`);

    // Manejar la imagen de portada si se proporciona un buffer de archivo
    if (coverImageBuffer) {
      console.log("[createZoneServer] Subiendo imagen de portada...");
      const bucket = adminStorage.bucket();
      const fileName = `images/zones/${generateSlug(zoneData.translations?.es?.title || 'sin-titulo')}-${Date.now()}`;
      const file = bucket.file(fileName);
      await file.save(coverImageBuffer);
      await file.makePublic(); // Hace la imagen accesible públicamente por URL
      finalData.coverImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      console.log("[createZoneServer] Imagen subida y URL generada:", finalData.coverImage);
    } else {
        finalData.coverImage = ''; // Asegura que el campo existe si no hay imagen
        console.log("[createZoneServer] No se proporcionó imagen de portada.");
    }

    // Formatear la fecha de publicación (pubDate) a Timestamp de Firebase
    if (typeof finalData.pubDate === 'string' || finalData.pubDate instanceof Date) {
        finalData.pubDate = Timestamp.fromDate(new Date(finalData.pubDate));
    } else {
        finalData.pubDate = Timestamp.now(); // Si no se proporciona o es inválida, usa la fecha actual
    }

    // --- Generar el slug principal (el mismo para ambos idiomas) ---
    // Se basa en el título en español y se le añade el prefijo /zones/
    finalData.slug = `/zones/${generateSlug(finalData.translations?.es?.title || '')}`;

    // Asegurar estructura de traducciones y campos por defecto
    finalData.translations = finalData.translations || { en: {}, es: {} };
    // Asegurar que 'description' y 'excerpt' estén dentro de 'translations'
    finalData.translations.es.description = finalData.translations.es.description || '';
    finalData.translations.es.excerpt = finalData.translations.es.excerpt || '';
    finalData.translations.en.description = finalData.translations.en.description || '';
    finalData.translations.en.excerpt = finalData.translations.en.excerpt || '';

    // El campo 'id' de la zona puede ser opcional o generarse si no se proporciona
    // Si quieres que el 'id' del documento sea el slug, puedes usar setDoc en lugar de addDoc
    // Por ahora, se generará un ID automático por Firestore.
    // finalData.id = finalData.id || generateSlug(finalData.translations.es.title || ''); // Si quieres un ID basado en el título

    // Añadir el documento a la colección 'zones' en Firestore
    const docRef = await adminDb.collection("zones").add(finalData);
    console.log("[createZoneServer] Zona creada con ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("[createZoneServer] Error al crear la zona (server):", error);
    throw error;
  }
}

// --- 2. LEER ZONAS (Read) ---
export async function getAllZonesServer() {
  console.log("[getAllZonesServer] Obteniendo todas las zonas (server)...");
  try {
    const querySnapshot = await adminDb.collection("zones").get(); // Colección 'zones'
    const zones = [];
    console.log("[getAllZonesServer] Zonas obtenidas (cantidad):", querySnapshot.size);
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.pubDate instanceof Timestamp) {
        data.pubDate = data.pubDate.toDate();
      }
      zones.push({ id: doc.id, ...data });
    });
    return zones;
  } catch (error) {
    console.error("[getAllZonesServer] Error al obtener todas las zonas (server):", error);
    throw error;
  }
}

export async function getZoneByIdServer(zoneId) {
  console.log(`[getZoneByIdServer] Obteniendo zona por ID (server): "${zoneId}"`);
  try {
    const docSnap = await adminDb.collection("zones").doc(zoneId).get(); // Colección 'zones'
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data.pubDate instanceof Timestamp) {
        data.pubDate = data.pubDate.toDate();
      }
      console.log("[getZoneByIdServer] Zona encontrada y obtenida.");
      return { id: docSnap.id, ...data };
    }
    console.log("[getZoneByIdServer] No se encontró la zona con ID:", zoneId);
    return null;
  } catch (error) {
    console.error("[getZoneByIdServer] Error al obtener zona por ID (server):", error);
    throw error;
  }
}

// --- 3. ACTUALIZAR ZONA (Update) ---
export async function updateZoneServer(zoneId, updatedData, newCoverImageBuffer = null) {
  console.log(`[updateZoneServer] Iniciando actualización para zona ID: "${zoneId}"`);
  try {
    const zoneRef = adminDb.collection("zones").doc(zoneId); // Colección 'zones'
    let finalData = { ...updatedData };

    // Formatear la fecha de publicación (pubDate) si está presente
    if (finalData.pubDate && (typeof finalData.pubDate === 'string' || finalData.pubDate instanceof Date)) {
        finalData.pubDate = Timestamp.fromDate(new Date(finalData.pubDate));
    }

    // Manejar la actualización de la imagen de portada
    if (newCoverImageBuffer) {
      console.log("[updateZoneServer] Subiendo nueva imagen de portada...");
      const currentZoneDoc = await zoneRef.get();
      const oldImageUrl = currentZoneDoc.exists ? currentZoneDoc.data().coverImage : null;

      const bucket = adminStorage.bucket();
      const fileName = `images/zones/${zoneId}-${Date.now()}`; // Ruta para imágenes de zonas
      const file = bucket.file(fileName);
      await file.save(newCoverImageBuffer);
      await file.makePublic();
      finalData.coverImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      console.log("[updateZoneServer] Nueva imagen subida:", finalData.coverImage);

      if (oldImageUrl && oldImageUrl.includes("storage.googleapis.com")) {
        try {
          const oldFilePath = oldImageUrl.split(`${bucket.name}/`)[1];
          if (oldFilePath) { await bucket.file(decodeURIComponent(oldFilePath)).delete(); }
          console.log("[updateZoneServer] Imagen de portada antigua borrada.");
        } catch (error) { console.warn("[updateZoneServer] No se pudo borrar la imagen antigua (puede que no exista o la URL sea incorrecta):", error.message); }
      }
    } else if (Object.prototype.hasOwnProperty.call(updatedData, 'coverImage') && updatedData.coverImage === null) {
        console.log("[updateZoneServer] Eliminando imagen de portada...");
        const currentZoneDoc = await zoneRef.get();
        const oldImageUrl = currentZoneDoc.exists ? currentZoneDoc.data().coverImage : null;
        const bucket = adminStorage.bucket();
        if (oldImageUrl && oldImageUrl.includes("storage.googleapis.com")) {
            try {
                const oldFilePath = oldImageUrl.split(`${bucket.name}/`)[1];
                if (oldFilePath) { await bucket.file(decodeURIComponent(oldFilePath)).delete(); }
                console.log("[updateZoneServer] Imagen de portada eliminada de Storage.");
            } catch (error) { console.warn("[updateZoneServer] No se pudo borrar la imagen de portada (puede que no exista):", error.message); }
        }
    }

    // --- Actualizar el slug principal si el título en español es proporcionado ---
    if (finalData.translations?.es?.title !== undefined) {
        finalData.slug = `/zones/${generateSlug(finalData.translations.es.title)}`;
        console.log("[updateZoneServer] Slug actualizado a:", finalData.slug);
    }

    // Asegurar que 'description' y 'excerpt' estén dentro de 'translations'
    if (finalData.translations?.es?.description !== undefined) {
      finalData['translations.es.description'] = finalData.translations.es.description;
    }
    if (finalData.translations?.es?.excerpt !== undefined) {
      finalData['translations.es.excerpt'] = finalData.translations.es.excerpt;
    }
    if (finalData.translations?.en?.description !== undefined) {
      finalData['translations.en.description'] = finalData.translations.en.description;
    }
    if (finalData.translations?.en?.excerpt !== undefined) {
      finalData['translations.en.excerpt'] = finalData.translations.en.excerpt;
    }

    await zoneRef.update(finalData);
    console.log("[updateZoneServer] Zona actualizada con ID (server):", zoneId);
  } catch (error) {
    console.error("[updateZoneServer] Error al actualizar la zona (server):", error);
    throw error;
  }
}

// --- 4. BORRAR ZONA (Delete) ---
export async function deleteZoneServer(zoneId) {
  console.log(`[deleteZoneServer] Iniciando borrado para zona ID: "${zoneId}"`);
  try {
    const zoneRef = adminDb.collection("zones").doc(zoneId); // Colección 'zones'
    const zoneDoc = await zoneRef.get();

    if (zoneDoc.exists) {
      const imageUrl = zoneDoc.data().coverImage;
      const bucket = adminStorage.bucket();
      if (imageUrl && imageUrl.includes("storage.googleapis.com")) {
        try {
          const imagePath = imageUrl.split(`${bucket.name}/`)[1];
          if (imagePath) { await bucket.file(decodeURIComponent(imagePath)).delete(); }
          console.log("[deleteZoneServer] Imagen de portada borrada de Storage.");
        } catch (error) { console.warn("[deleteZoneServer] No se pudo borrar la imagen de Storage (puede que no exista o la URL sea incorrecta):", error.message); }
      }

      await zoneRef.delete();
      console.log("[deleteZoneServer] Documento borrado de Firestore.");
    } else {
      console.log("[deleteZoneServer] No se encontró la zona con ID para borrar:", zoneId);
    }
  } catch (error) {
    console.error("[deleteZoneServer] Error al borrar la zona (server):", error);
    throw error;
  }
}