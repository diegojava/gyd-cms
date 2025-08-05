// src/lib/blog-crud-server.js
import * as adminModule from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { Buffer } from 'node:buffer';

// El objeto 'admin' del SDK sigue siendo necesario para operaciones como FieldValue.delete()
const admin = adminModule.default;

// 1. IMPORTAMOS LA NUEVA FUNCIÓN DE INICIALIZACIÓN
import { getFirebaseAdmin } from './firebase-admin-config';

// --- Funciones de ayuda (sin cambios) ---
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

function isEmptyHtml(htmlString) {
  if (!htmlString) return true;
  const plainText = htmlString.replace(/<[^>]*>/g, '').trim();
  return plainText === '';
}


// --- 1. CREAR POST (Create) ---
export async function createPostServer(postData, coverImageBuffer = null) {
  // 2. OBTENEMOS LAS INSTANCIAS DE FIREBASE AL INICIO DE LA FUNCIÓN
  const { adminDb, adminStorage } = getFirebaseAdmin();
  if (!adminDb || !adminStorage) {
    throw new Error("La conexión con Firebase (adminDb o adminStorage) no está inicializada.");
  }

  try {
    let finalData = { ...postData };

    if (coverImageBuffer) {
      const bucket = adminStorage.bucket();
      const fileName = `images/posts/${generateSlug(postData.translations?.es?.title || 'sin-titulo')}-${Date.now()}`;
      const file = bucket.file(fileName);
      await file.save(coverImageBuffer);
      await file.makePublic();
      finalData.coverImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    } else {
      finalData.coverImage = '';
    }

    finalData.pubDate = Timestamp.fromDate(new Date(finalData.pubDate || Date.now()));
    finalData.slug = {
      es: finalData.translations?.es?.title ? generateSlug(finalData.translations.es.title) : '',
      en: finalData.translations?.en?.title ? generateSlug(finalData.translations.en.title) : ''
    };

    finalData.translations = finalData.translations || { en: {}, es: {} };
    finalData.translations.es.content = finalData.translations.es.content || '';
    finalData.translations.es.excerpt = finalData.translations.es.excerpt || '';
    finalData.translations.en.content = finalData.translations.en.content || '';
    finalData.translations.en.excerpt = finalData.translations.en.excerpt || '';
    finalData.categories = finalData.categories || [];
    finalData.draft = typeof finalData.draft === 'boolean' ? finalData.draft : true;

    const docRef = await adminDb.collection("posts").add(finalData);
    return docRef.id;
  } catch (error) {
    console.error("[createPostServer] Error:", error);
    throw error;
  }
}

// --- 2. LEER POSTS (Read) ---
export async function getAllPostsServer() {
  const { adminDb } = getFirebaseAdmin();
  if (!adminDb) {
    throw new Error("La conexión con Firebase (adminDb) no está inicializada.");
  }

  try {
    // Ordenamos por fecha de publicación descendente, que es lo común en un blog.
    const querySnapshot = await adminDb.collection("posts").orderBy('pubDate', 'desc').get();
    const posts = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Convertimos el Timestamp a un string ISO para que sea compatible con JSON
      if (data.pubDate instanceof Timestamp) {
        data.pubDate = data.pubDate.toDate().toISOString();
      }
      posts.push({ id: doc.id, ...data });
    });
    return posts;
  } catch (error) {
    console.error("[getAllPostsServer] Error:", error);
    throw error;
  }
}

export async function getPostByIdServer(postId) {
  const { adminDb } = getFirebaseAdmin();
  if (!adminDb) {
    throw new Error("La conexión con Firebase (adminDb) no está inicializada.");
  }

  try {
    const docSnap = await adminDb.collection("posts").doc(postId).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data.pubDate instanceof Timestamp) {
        data.pubDate = data.pubDate.toDate().toISOString();
      }
      return { id: docSnap.id, ...data };
    }
    return null;
  } catch (error) {
    console.error("[getPostByIdServer] Error:", error);
    throw error;
  }
}

// --- 3. ACTUALIZAR POST (Update) ---
export async function updatePostServer(postId, updatedData, newCoverImageBuffer = null) {
  const { adminDb, adminStorage } = getFirebaseAdmin();
  if (!adminDb || !adminStorage) {
    throw new Error("La conexión con Firebase no está inicializada.");
  }

  try {
    const postRef = adminDb.collection("posts").doc(postId);
    const dataToUpdate = {}; // Objeto para almacenar solo los campos que cambian

    // --- 1. Manejar la imagen de portada ---
    if (newCoverImageBuffer) {
      console.log("[updatePostServer] Subiendo nueva imagen de portada...");
      const bucket = adminStorage.bucket();

      // Opcional: Borrar la imagen antigua para no dejar basura
      const currentPostDoc = await postRef.get();
      const oldImageUrl = currentPostDoc.exists ? currentPostDoc.data().coverImage : null;
      if (oldImageUrl && oldImageUrl.includes("storage.googleapis.com")) {
        try {
          const oldFilePath = oldImageUrl.split(`${bucket.name}/`)[1].split('?')[0];
          if (oldFilePath) await bucket.file(decodeURIComponent(oldFilePath)).delete();
        } catch (e) {
          console.warn("No se pudo borrar la imagen antigua:", e.message);
        }
      }

      // Subir la nueva imagen
      const fileName = `images/posts/${postId}-${Date.now()}`;
      const file = bucket.file(fileName);
      await file.save(newCoverImageBuffer);
      await file.makePublic();
      dataToUpdate.coverImage = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      console.log("[updatePostServer] Nueva imagen subida:", dataToUpdate.coverImage);

    } else if (updatedData.coverImage === null) {
      // Si se marcó "Eliminar imagen actual"
      console.log("[updatePostServer] Eliminando imagen de portada...");
      dataToUpdate.coverImage = ""; // O FieldValue.delete() si prefieres
    }

    // --- 2. Manejar los campos de texto y otros datos ---
    if (updatedData.pubDate) {
      dataToUpdate.pubDate = Timestamp.fromDate(new Date(updatedData.pubDate));
    }
    if (updatedData.categories) {
      dataToUpdate.categories = updatedData.categories;
    }
    if (updatedData.draft !== undefined) {
      dataToUpdate.draft = updatedData.draft;
    }

    // Usamos dot notation para actualizar campos anidados
    const esTrans = updatedData.translations?.es || {};
    const enTrans = updatedData.translations?.en || {};

    for (const key in esTrans) {
      dataToUpdate[`translations.es.${key}`] = esTrans[key];
    }
    for (const key in enTrans) {
      dataToUpdate[`translations.en.${key}`] = enTrans[key];
    }

    // Regenerar slugs si los títulos cambiaron
    if (esTrans.title) {
      dataToUpdate['slug.es'] = generateSlug(esTrans.title);
    }
    if (enTrans.title) {
      dataToUpdate['slug.en'] = generateSlug(enTrans.title);
    }

    // --- 3. Ejecutar la actualización en Firestore ---
    if (Object.keys(dataToUpdate).length > 0) {
      await postRef.update(dataToUpdate);
      console.log("[updatePostServer] Post actualizado con los siguientes campos:", Object.keys(dataToUpdate));
    } else {
      console.log("[updatePostServer] No hubo campos que actualizar.");
    }

  } catch (error) {
    console.error("[updatePostServer] Error al actualizar el post:", error);
    throw error;
  }
}

// --- 4. BORRAR POST (Delete) ---
export async function deletePostServer(postId) {
  const { adminDb, adminStorage } = getFirebaseAdmin();
  if (!adminDb || !adminStorage) {
    throw new Error("La conexión con Firebase (adminDb o adminStorage) no está inicializada.");
  }

  try {
    const postRef = adminDb.collection("posts").doc(postId);
    const postDoc = await postRef.get();

    if (postDoc.exists) {
      const imageUrl = postDoc.data().coverImage;
      if (imageUrl && imageUrl.includes("storage.googleapis.com")) {
        const bucket = adminStorage.bucket();
        try {
          const imagePath = imageUrl.split(`${bucket.name}/`)[1];
          if (imagePath) await bucket.file(decodeURIComponent(imagePath)).delete();
        } catch (e) {
          console.warn("No se pudo borrar la imagen de Storage:", e.message);
        }
      }
      await postRef.delete();
    }
  } catch (error) {
    console.error("[deletePostServer] Error:", error);
    throw error;
  }
}