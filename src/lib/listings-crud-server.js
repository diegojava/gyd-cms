// src/lib/blog-crud-server.js
// ¡IMPORTANTE! Este archivo SOLO debe ser importado en tus API Routes.
// NUNCA en código que se ejecute en el navegador.

import * as adminModule from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore'; // Importar Timestamp desde firebase-admin/firestore
import { Buffer } from 'node:buffer'; // Necesario para manejar archivos en Node.js (ej. de FormData a Buffer)

// El objeto 'admin' real del SDK se encuentra en la propiedad 'default'
// Esto resuelve el problema de "admin.credential is undefined"
const admin = adminModule.default;

// Asegúrate de que las instancias de adminDb, adminStorage y adminAuth se exporten desde tu configuración
// Y que la inicialización se haga en firebase-admin-config.js
import { adminDb, adminStorage, adminAuth } from './firebase-admin-config';


// --- Función de ayuda para generar slug ---
// Esta función crea slugs limpios y aptos para SEO.
function generateSlug(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .normalize("NFD") // Normaliza caracteres acentuados (ej. "á" -> "a")
    .replace(/[\u0300-\u036f]/g, "") // Remueve diacríticos (los acentos después de normalizar)
    .replace(/[^a-z0-9\s-]/g, "") // Remueve caracteres no alfanuméricos (excepto espacios y guiones)
    .replace(/\s+/g, '-') // Reemplaza uno o más espacios con un guion
    .replace(/-+/g, '-') // Reemplaza múltiples guiones con uno solo
    .trim(); // Elimina espacios al inicio/final
}


// --- 1. CREAR POST (Create) ---
/**
 * Crea un nuevo post en Firestore, subiendo la imagen de portada a Storage.
 * @param {Object} postData - Objeto con los datos del post (translations.es.title, translations.en.title, content, excerpt, categories[], draft, etc.)
 * @param {Buffer | null} coverImageBuffer - Buffer de datos de la imagen de portada (opcional).
 * @returns {Promise<string>} ID del documento creado.
 */
export async function createPostServer(postData, coverImageBuffer = null) {
  try {
    let finalData = { ...postData };
    console.log(`[createPostServer] Iniciando creación de post. Título ES: "${postData.translations?.es?.title}"`);

    // Manejar la imagen de portada si se proporciona un buffer de archivo
    if (coverImageBuffer) {
      console.log("[createPostServer] Subiendo imagen de portada...");
      const bucket = adminStorage.bucket(); // Obtiene el bucket asociado a la instancia de Storage de adminStorage
      const fileName = `images/posts/${generateSlug(postData.translations?.es?.title || 'sin-titulo')}-${Date.now()}`;
      const file = bucket.file(fileName);
      await file.save(coverImageBuffer);
      await file.makePublic(); // Hace la imagen accesible públicamente por URL
      finalData.coverImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      console.log("[createPostServer] Imagen subida y URL generada:", finalData.coverImage);
    } else {
        finalData.coverImage = ''; // Asegura que el campo existe si no hay imagen
        console.log("[createPostServer] No se proporcionó imagen de portada.");
    }

    // Formatear la fecha de publicación (pubDate) a Timestamp de Firebase
    if (typeof finalData.pubDate === 'string' || finalData.pubDate instanceof Date) {
        finalData.pubDate = Timestamp.fromDate(new Date(finalData.pubDate));
    } else {
        finalData.pubDate = Timestamp.now(); // Si no se proporciona o es inválida, usa la fecha actual
    }

    // --- Generar slugs para ambos idiomas y almacenarlos en un MAP anidado 'slug' ---
    finalData.slug = {
      es: finalData.translations?.es?.title ? generateSlug(finalData.translations.es.title) : '',
      en: finalData.translations?.en?.title ? generateSlug(finalData.translations.en.title) : ''
    };
    // Limpiar campos de slugs antiguos (slug_es, slug_en) si existen de una estructura previa
    delete finalData.slug_es;
    delete finalData.slug_en;

    // Asegurar estructura de traducciones y campos por defecto
    finalData.translations = finalData.translations || { en: {}, es: {} };
    // Asegurar que 'excerpt' esté dentro de 'translations' si no viene definido
    finalData.translations.es.excerpt = finalData.translations.es.excerpt || '';
    finalData.translations.en.excerpt = finalData.translations.en.excerpt || '';

    finalData.categories = finalData.categories || [];
    finalData.draft = typeof finalData.draft === 'boolean' ? finalData.draft : true;

    // Añadir el documento a la colección 'posts' en Firestore
    const docRef = await adminDb.collection("posts").add(finalData);
    console.log("[createPostServer] Post creado con ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("[createPostServer] Error al crear el post (server):", error);
    throw error;
  }
}

// --- 2. LEER POSTS (Read) ---
export async function getAllPostsServer() {
  console.log("[getAllPostsServer] Obteniendo todos los posts (server)...");
  try {
    const querySnapshot = await adminDb.collection("listings").get();
    const posts = [];
    console.log("[getAllPostsServer] Posts obtenidos (cantidad):", querySnapshot.size);
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Convertir Timestamp a objeto Date de JS para facilitar el manejo en el frontend
      if (data.pubDate instanceof Timestamp) {
        data.pubDate = data.pubDate.toDate();
      }
      posts.push({ id: doc.id, ...data });
    });
    return posts;
  } catch (error) {
    console.error("[getAllPostsServer] Error al obtener todos los posts (server):", error);
    throw error;
  }
}

export async function getPostByIdServer(postId) {
  console.log(`[getPostByIdServer] Obteniendo post por ID (server): "${postId}"`);
  try {
    const docSnap = await adminDb.collection("listings").doc(postId).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data.pubDate instanceof Timestamp) {
        data.pubDate = data.pubDate.toDate();
      }
      console.log("[getPostByIdServer] Post encontrado y obtenido.");
      return { id: docSnap.id, ...data };
    }
    console.log("[getPostByIdServer] No se encontró el post con ID:", postId);
    return null;
  } catch (error) {
    console.error("[getPostByIdServer] Error al obtener post por ID (server):", error);
    throw error;
  }
}

// --- 3. ACTUALIZAR POST (Update) ---
export async function updatePostServer(postId, updatedData, newCoverImageBuffer = null) {
  console.log(`[updatePostServer] Iniciando actualización para post ID: "${postId}"`);
  try {
    const postRef = adminDb.collection("posts").doc(postId);
    let finalData = { ...updatedData };

    // Formatear la fecha de publicación (pubDate) si está presente
    if (finalData.pubDate && (typeof finalData.pubDate === 'string' || finalData.pubDate instanceof Date)) {
        finalData.pubDate = Timestamp.fromDate(new Date(finalData.pubDate));
    }

    // Manejar la actualización de la imagen de portada
    if (newCoverImageBuffer) {
      console.log("[updatePostServer] Subiendo nueva imagen de portada...");
      const currentPostDoc = await postRef.get();
      const oldImageUrl = currentPostDoc.exists ? currentPostDoc.data().coverImage : null;

      const bucket = adminStorage.bucket();
      const fileName = `images/posts/${postId}-${Date.now()}`;
      const file = bucket.file(fileName);
      await file.save(newCoverImageBuffer);
      await file.makePublic();
      finalData.coverImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      console.log("[updatePostServer] Nueva imagen subida:", finalData.coverImage);

      // Borrar la imagen antigua de Storage si existe y es una URL de Storage
      if (oldImageUrl && oldImageUrl.includes("storage.googleapis.com")) {
        try {
          const oldFilePath = oldImageUrl.split(`${bucket.name}/`)[1];
          if (oldFilePath) { await bucket.file(decodeURIComponent(oldFilePath)).delete(); }
          console.log("[updatePostServer] Imagen de portada antigua borrada.");
        } catch (error) { console.warn("[updatePostServer] No se pudo borrar la imagen antigua (puede que no exista o la URL sea incorrecta):", error.message); }
      }
    } else if (Object.prototype.hasOwnProperty.call(updatedData, 'coverImage') && updatedData.coverImage === null) {
        // Si se pide explícitamente eliminar la imagen (coverImage: null)
        console.log("[updatePostServer] Eliminando imagen de portada...");
        const currentPostDoc = await postRef.get();
        const oldImageUrl = currentPostDoc.exists ? currentPostDoc.data().coverImage : null;
        const bucket = adminStorage.bucket();
        if (oldImageUrl && oldImageUrl.includes("storage.googleapis.com")) {
            try {
                const oldFilePath = oldImageUrl.split(`${bucket.name}/`)[1];
                if (oldFilePath) { await bucket.file(decodeURIComponent(oldFilePath)).delete(); }
                console.log("[updatePostServer] Imagen de portada eliminada de Storage.");
            } catch (error) { console.warn("[updatePostServer] No se pudo borrar la imagen de portada (puede que no exista):", error.message); }
        }
    }

    // --- Actualizar slugs en un MAP anidado si los títulos son proporcionados en la actualización ---
    let shouldUpdateSlugs = false;
    const currentSlugs = {}; // Para construir las partes del slug a actualizar

    if (finalData.translations?.es?.title !== undefined) {
      currentSlugs.es = generateSlug(finalData.translations.es.title);
      shouldUpdateSlugs = true;
    }
    if (finalData.translations?.en?.title !== undefined) {
      currentSlugs.en = generateSlug(finalData.translations.en.title);
      shouldUpdateSlugs = true;
    }

    if (shouldUpdateSlugs) {
        // Actualiza los campos anidados directamente. Firestore los fusionará o creará el mapa 'slug'.
        finalData['slug.es'] = currentSlugs.es;
        finalData['slug.en'] = currentSlugs.en;
        console.log("[updatePostServer] Slugs actualizados a:", currentSlugs);
    }

    // --- Actualizar el campo 'excerpt' si está presente en updatedData ---
    if (finalData.translations?.es?.excerpt !== undefined) {
      finalData['translations.es.excerpt'] = finalData.translations.es.excerpt;
    }
    if (finalData.translations?.en?.excerpt !== undefined) {
      finalData['translations.en.excerpt'] = finalData.translations.en.excerpt;
    }

    // Limpiar campos de slugs antiguos si existen de una estructura anterior
    delete finalData.slug_es;
    delete finalData.slug_en;
    delete finalData.slug; // Si el campo 'slug' de nivel superior ya no se usa, eliminarlo.

    await postRef.update(finalData);
    console.log("[updatePostServer] Post actualizado con ID (server):", postId);
  } catch (error) {
    console.error("[updatePostServer] Error al actualizar el post (server):", error);
    throw error;
  }
}

// --- 4. BORRAR POST (Delete) ---
export async function deletePostServer(postId) {
  console.log(`[deletePostServer] Iniciando borrado para post ID: "${postId}"`);
  try {
    const postRef = adminDb.collection("posts").doc(postId);
    const postDoc = await postRef.get();

    if (postDoc.exists) {
      const imageUrl = postDoc.data().coverImage;
      const bucket = adminStorage.bucket(); // Obtiene el bucket asociado a la instancia de Storage
      if (imageUrl && imageUrl.includes("storage.googleapis.com")) {
        try {
          const imagePath = imageUrl.split(`${bucket.name}/`)[1];
          if (imagePath) { await bucket.file(decodeURIComponent(imagePath)).delete(); }
          console.log("[deletePostServer] Imagen de portada borrada de Storage.");
        } catch (error) { console.warn("[deletePostServer] No se pudo borrar la imagen de Storage (puede que no exista o la URL sea incorrecta):", error.message); }
      }

      await postRef.delete();
      console.log("[deletePostServer] Documento borrado de Firestore.");
    } else {
      console.log("[deletePostServer] No se encontró el post con ID para borrar:", postId);
    }
  } catch (error) {
    console.error("[deletePostServer] Error al borrar el post (server):", error);
    throw error;
  }
}