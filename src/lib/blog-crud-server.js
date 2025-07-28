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

// --- Función de ayuda para determinar si una cadena HTML está vacía de contenido visible ---
// Útil para campos de TinyMCE que pueden devolver "<p></p>" o "<p>&nbsp;</p>"
function isEmptyHtml(htmlString) {
    if (!htmlString) return true; // Si es null, undefined o cadena vacía
    const plainText = htmlString.replace(/<[^>]*>/g, '').trim(); // Quita todas las etiquetas HTML y luego trimea el texto plano
    return plainText === '';
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
    // Asegurar que 'content' y 'excerpt' estén dentro de 'translations' con valor por defecto
    finalData.translations.es.content = finalData.translations.es.content || '';
    finalData.translations.es.excerpt = finalData.translations.es.excerpt || '';
    finalData.translations.en.content = finalData.translations.en.content || '';
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
    const querySnapshot = await adminDb.collection("posts").get();
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
    const docSnap = await adminDb.collection("posts").doc(postId).get();
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
    let finalDataToProcess = { ...updatedData }; // Copia los datos recibidos del frontend

    // --- CRUCIAL FIX: Eliminar el objeto 'translations' completo de nivel superior
    //                  lo reconstruiremos con dot notation para evitar "specified multiple times."
    delete finalDataToProcess.translations;

    // Formatear la fecha de publicación (pubDate) si está presente
    if (finalDataToProcess.pubDate && (typeof finalDataToProcess.pubDate === 'string' || finalDataToProcess.pubDate instanceof Date)) {
        finalDataToProcess.pubDate = Timestamp.fromDate(new Date(finalDataToProcess.pubDate));
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
      finalDataToProcess.coverImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      console.log("[updatePostServer] Nueva imagen subida:", finalDataToProcess.coverImage);

      // Borrar la imagen antigua de Storage si existe y es una URL de Storage
      if (oldImageUrl && oldImageUrl.includes("storage.googleapis.com")) {
        try {
          const oldFilePath = oldImageUrl.split(`${bucket.name}/`)[1];
          if (oldFilePath) { await bucket.file(decodeURIComponent(oldFilePath)).delete(); }
          console.log("[updatePostServer] Imagen de portada antigua borrada.");
        } catch (error) { console.warn("[updatePostServer] No se pudo borrar la imagen antigua (puede que no exista o la URL sea incorrecta):", error.message); }
      }
    } else if (Object.prototype.hasOwnProperty.call(updatedData, 'coverImage') && updatedData.coverImage === null) {
        // Si se pide explícitamente eliminar la imagen (coverImage: null del frontend)
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
    // Si no hay nuevo archivo y NO se marcó para borrar, no incluimos 'coverImage' en finalDataToProcess.
    // updateDoc ignora los campos no presentes, manteniendo el valor actual en Firestore.


    // --- Reconstruir los campos de traducciones y slugs usando dot notation ---
    // Accedemos a los datos de traducción originales de updatedData
    const esTrans = updatedData.translations?.es || {};
    const enTrans = updatedData.translations?.en || {};

    // Títulos (siempre se actualizan si se mandan)
    if (esTrans.title !== undefined) finalDataToProcess['translations.es.title'] = esTrans.title;
    if (enTrans.title !== undefined) finalDataToProcess['translations.en.title'] = enTrans.title;

    // Contenido (borrar si está vacío de HTML o texto)
    if (esTrans.content !== undefined) {
        finalDataToProcess['translations.es.content'] = isEmptyHtml(esTrans.content) ? admin.firestore.FieldValue.delete() : esTrans.content;
    }
    if (enTrans.content !== undefined) {
        finalDataToProcess['translations.en.content'] = isEmptyHtml(enTrans.content) ? admin.firestore.FieldValue.delete() : enTrans.content;
    }

    // Resumen (excerpt - borrar si está vacío de HTML o texto)
    if (esTrans.excerpt !== undefined) {
        finalDataToProcess['translations.es.excerpt'] = isEmptyHtml(esTrans.excerpt) ? admin.firestore.FieldValue.delete() : esTrans.excerpt;
    }
    if (enTrans.excerpt !== undefined) {
        finalDataToProcess['translations.en.excerpt'] = isEmptyHtml(enTrans.excerpt) ? admin.firestore.FieldValue.delete() : enTrans.excerpt;
    }

    // Actualizar slugs en el MAP anidado 'slug' (si el título correspondiente se actualiza)
    if (esTrans.title !== undefined) {
      finalDataToProcess['slug.es'] = generateSlug(esTrans.title);
    }
    if (enTrans.title !== undefined) {
      finalDataToProcess['slug.en'] = generateSlug(enTrans.title);
    }


    // Limpiar campos de slugs antiguos si existen de una estructura anterior (solo por si acaso)
    delete finalDataToProcess.slug_es;
    delete finalDataToProcess.slug_en;
    delete finalDataToProcess.slug; // Si el campo 'slug' de nivel superior ya no se usa, eliminarlo.


    // --- Filtrar valores 'undefined' antes de la actualización (CRÍTICO para Firestore) ---
    // Firestore no permite valores 'undefined'. Este paso asegura que solo se envíen valores válidos.
    const dataToUpdate = {};
    for (const key in finalDataToProcess) {
        if (finalDataToProcess[key] !== undefined) {
            dataToUpdate[key] = finalDataToProcess[key];
        }
    }

    // Ejecutar la actualización en Firestore
    await postRef.update(dataToUpdate);
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